import { cloneElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock, Cloud, FileText, Loader2, Package, Plus, Save, Send, Ship, Trash2, X } from 'lucide-react'
import exportBookingService from '../../services/exportBookingService'
import { bookingService } from '../../services/bookingService'
import { sourceOperation } from '../../features/booking-dispatch/bookingPlanning'
import { cargoNames, declarationProblems, equipmentAssessment, equipmentDemand, preparationContent, preparationKey, preparedSource, requestProblems } from '../../features/booking-dispatch/exportPreparation'

const input = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-500'
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50'
const tones = ['border-teal-200 bg-teal-50/60', 'border-sky-200 bg-sky-50/60', 'border-violet-200 bg-violet-50/60', 'border-amber-200 bg-amber-50/60']
const date = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa công bố'
const errorText = error => {
  const data = error.response?.data, errors = data?.errors || data?.Errors
  return errors ? Object.values(errors).flat().join('\n') : data?.message || data?.Message || error.message || 'Không thể lưu hồ sơ.'
}
function Field({ label, children }) {
  const fieldId = useId()
  return <div className="min-w-0 space-y-1.5 text-sm"><label htmlFor={fieldId} className="block font-semibold text-slate-700">{label}</label>{cloneElement(children, { id: fieldId })}</div>
}

export default function ExportPreparationForm({ options, sourcesLoading, sourcesError, initialSource, existing, draft, intent = 'request', modeSelector, onSubmitted, onClose, onBusyChange, onDraftSaved, onResumeDraft }) {
  const confirming = intent === 'containers'
  const [content, setContent] = useState(() => {
    const value = preparationContent(draft?.content || existing?.preparation || {}, existing?.id)
    if (confirming) value.mode = 'containers'
    if (!value.shippingLineId && options.shippingLines.length === 1) value.shippingLineId = options.shippingLines[0].id
    if (initialSource && !value.containers.length) {
      const row = options.sources.find(row => row.containerId === initialSource.containerId && (!initialSource.declarationId || row.declarationId === initialSource.declarationId))
      if (row) value.containers = [preparedSource(row)]
    }
    return value
  })
  const [step, setStep] = useState(confirming ? 1 : 0), [openGroups, setOpenGroups] = useState(new Set()), [openRows, setOpenRows] = useState(new Set())
  const [saving, setSaving] = useState(false), [savedAt, setSavedAt] = useState(draft?.updatedAt || ''), [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(''), [specs, setSpecs] = useState([]), [error, setError] = useState(''), [checks, setChecks] = useState(null), [checking, setChecking] = useState(false)
  const [conflict, setConflict] = useState(false), [scope, setScope] = useState('shared')
  const id = useId(), alive = useRef(true), latest = useRef(content), dirty = useRef(false), saveChain = useRef(Promise.resolve())
  const meta = useRef({ id: draft?.id || crypto.randomUUID(), version: draft?.version || 0 })
  const savedKey = useRef(draft ? JSON.stringify(content) : ''), failedAttempt = useRef(null), sendAttempt = useRef(null), sendingRef = useRef(false), conflictRef = useRef(false)
  latest.current = content
  const busy = sending || Boolean(uploading)
  const voyage = options.voyages.find(row => row.id === content.voyageId) || existing?.voyage
  const voyages = options.voyages.filter(row => row.shippingLineId === content.shippingLineId)
  const demand = equipmentDemand(content), quantity = demand.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const approvedEquipment = existing?.preparation?.equipmentRequests || []
  const equipmentRows = confirming ? equipmentAssessment(approvedEquipment, content.containers) : []
  const approvedQuantity = approvedEquipment.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const cargo = content.containers[0]?.cargoType
  const sources = useMemo(() => {
    const own = existing?.preparation?.containers || []
    const selected = new Map(content.containers.map(row => [row.containerId, preparationKey(row)])), seen = new Set()
    return [...options.sources, ...own, ...content.containers].filter(row => {
      if (seen.has(row.containerId) || (selected.has(row.containerId) && selected.get(row.containerId) !== preparationKey(row))) return false
      seen.add(row.containerId); return true
    })
  }, [options.sources, existing, content.containers])
  const groups = [...sources.reduce((map, row) => { if (!map.has(row.cargoType)) map.set(row.cargoType, []); map.get(row.cargoType).push(row); return map }, new Map())]
  const patch = value => { dirty.current = true; setContent(current => ({ ...current, ...value, sharedDocumentsConfirmed: false })); setChecks(null); setError('') }
  const patchRow = (key, values) => { dirty.current = true; setContent(current => ({ ...current, containers: current.containers.map(row => preparationKey(row) === key ? { ...row, ...values } : row) })); setChecks(null) }
  const persist = snapshot => {
    const task = saveChain.current.catch(() => {}).then(async () => {
      const key = JSON.stringify(snapshot)
      if (savedKey.current === key) return meta.current
      if (conflictRef.current) throw new Error('Bản nháp đã thay đổi ở phiên khác. Dùng nút Tải lại nháp trước khi lưu tiếp.')
      if (alive.current) setSaving(true)
      if (!failedAttempt.current || failedAttempt.current.key !== key) failedAttempt.current = { key, requestId: crypto.randomUUID() }
      try {
        const result = await exportBookingService.saveDraft(meta.current.id, { requestId: failedAttempt.current.requestId, expectedVersion: meta.current.version, content: snapshot })
        meta.current = { id: result.id, version: result.version }; savedKey.current = key; failedAttempt.current = null
        if (alive.current) { setSavedAt(result.updatedAt); Promise.resolve(onDraftSaved?.(result)).catch(() => {}); setError('') }
        return meta.current
      } catch (cause) {
        if (cause.response?.status === 409) { conflictRef.current = true; if (alive.current) setConflict(true) }
        if (alive.current) setError(errorText(cause))
        throw cause
      } finally { if (alive.current) setSaving(false) }
    })
    saveChain.current = task
    return task
  }
  const persistRef = useRef(persist); persistRef.current = persist
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (dirty.current && !sendingRef.current) persistRef.current(latest.current).catch(() => {}) }
  }, [])
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  useEffect(() => {
    if (!dirty.current || conflict) return
    const timer = setTimeout(() => persistRef.current(content).catch(() => {}), 1100)
    return () => clearTimeout(timer)
  }, [content, conflict])
  useEffect(() => {
    const beforeUnload = event => { if (dirty.current && savedKey.current !== JSON.stringify(latest.current)) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  useEffect(() => {
    let active = true
    setSpecs([])
    if (cargo) bookingService.getOperationRequirements({ operationType: 'Export', cargoStatus: 'Loaded', cargoType: sourceOperation({ cargoType: cargo }).cargoType })
      .then(rows => { if (active) setSpecs(rows.filter(row => row.documentType !== 'CarrierBookingReference').map(row => ({ ...row, isMandatory: row.isMandatory && row.documentType !== 'VgmCertificate' }))) })
      .catch(cause => { if (active) setError(errorText(cause)) })
    return () => { active = false }
  }, [cargo])
  useEffect(() => { if (scope !== 'shared' && !content.containers.some(row => preparationKey(row) === scope)) setScope('shared') }, [scope, content.containers])
  const toggle = row => {
    const present = content.containers.some(c => c.containerId === row.containerId)
    if (!present && ((cargo && cargo !== row.cargoType) || content.containers.length >= 50)) return
    patch({ containers: present ? content.containers.filter(c => c.containerId !== row.containerId) : [...content.containers, preparedSource(row)] })
  }
  const toggleGroup = type => setOpenGroups(current => { const next = new Set(current); if (next.has(type)) next.delete(type); else next.add(type); return next })
  const upload = async (spec, event) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || uploading) return
    if (file.size > 25 * 1024 * 1024) { setError('Tệp chứng từ tối đa 25 MB.'); return }
    const target = scope, type = spec.documentType
    setUploading(type); setError('')
    try {
      const result = await exportBookingService.uploadPreparationDocument(file)
      if (!result.documentId || !result.fileUrl) throw new Error('Chưa lưu được chứng từ trên S3.')
      if (!alive.current) return
      const document = { ...result, documentType: type, containerNumbers: target === 'shared' ? [] : [content.containers.find(row => preparationKey(row) === target)?.containerNumber].filter(Boolean) }
      const replace = docs => [...docs.filter(doc => doc.documentType !== type), document]
      dirty.current = true
      setContent(current => target === 'shared' ? { ...current, sharedDocuments: replace(current.sharedDocuments), sharedDocumentsConfirmed: false }
        : { ...current, containers: current.containers.map(row => preparationKey(row) === target ? { ...row, documents: replace(row.documents) } : row) })
      setChecks(null)
    } catch (cause) { if (alive.current) setError(errorText(cause)) }
    finally { if (alive.current) setUploading('') }
  }
  const runChecks = async () => {
    setChecking(true); setError('')
    try {
      const result = await exportBookingService.checkPreparation(content)
      const problems = confirming ? declarationProblems(content, approvedEquipment) : []
      const assessment = { ...result, cargoReady: result.cargoReady && problems.length === 0, messages: [...(result.messages || []), ...problems] }
      if (alive.current) setChecks({ ...assessment, key: JSON.stringify(content) })
      return assessment
    }
    catch (cause) { if (alive.current) setError(errorText(cause)); return null }
    finally { if (alive.current) setChecking(false) }
  }
  const send = async () => {
    if (sendingRef.current) return
    const problems = confirming ? declarationProblems(content, approvedEquipment) : requestProblems(content)
    if (problems.length) { setError(problems.join('\n')); return }
    sendingRef.current = true; setSending(true); setError('')
    try {
      if (confirming) { const ready = await runChecks(); if (!ready?.cargoReady) return }
      const saved = await persist(content)
      const key = JSON.stringify(content)
      if (!sendAttempt.current || sendAttempt.current.key !== key) sendAttempt.current = { key, requestId: crypto.randomUUID() }
      const request = { requestId: sendAttempt.current.requestId, bookingId: existing?.id || null, expectedVersion: existing?.version || 0, draftId: saved.id, expectedDraftVersion: saved.version, content }
      const result = confirming ? await exportBookingService.confirmPreparation(existing.id, request) : await exportBookingService.submitPreparation(request)
      dirty.current = false
      if (alive.current) await onSubmitted(result)
    } catch (cause) { if (alive.current) setError(errorText(cause)) }
    finally { sendingRef.current = false; if (alive.current) setSending(false) }
  }
  const reloadDraft = async () => {
    try {
      const result = await exportBookingService.getDraft(meta.current.id)
      meta.current.version = result.version; conflictRef.current = false; setConflict(false)
      const restored = preparationContent(result.content, existing?.id)
      if (confirming) restored.mode = 'containers'
      savedKey.current = JSON.stringify(restored); dirty.current = false
      setContent(restored); setSavedAt(result.updatedAt); setError(''); setChecks(null)
    } catch (cause) { setError(errorText(cause)) }
  }
  const close = async () => { try { if (dirty.current) await persist(content); onClose?.() } catch { /* Keep the form open when saving failed. */ } }
  const docs = scope === 'shared' ? content.sharedDocuments : content.containers.find(row => preparationKey(row) === scope)?.documents || []
  const actualSpecs = specs.length ? specs : [{ documentType: 'CustomsDeclaration', nameVi: 'Tờ khai hải quan xuất khẩu', isMandatory: false }, { documentType: 'VgmCertificate', nameVi: 'Phiếu xác nhận VGM', isMandatory: false }]
  const validChecks = checks?.key === JSON.stringify(content) ? checks : null
  const steps = ['Nhu cầu đặt chỗ', 'Container & chứng từ', confirming ? 'Gửi danh sách hãng tàu' : 'Kiểm tra & gửi yêu cầu']
  const saveStatus = saving ? 'Đang lưu nháp…' : dirty.current && savedKey.current !== JSON.stringify(content) ? 'Đang chờ lưu…' : savedAt ? `Đã lưu ${date(savedAt)}` : 'Nháp riêng của công ty'

  return <div className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label="Chuẩn bị hồ sơ xuất khẩu">
    <div className="rounded-t-3xl border-b border-slate-100 bg-gradient-to-br from-orange-50 via-white to-sky-50 px-5 py-5 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm"><Ship className="h-6 w-6" /></span><div><p className="text-[11px] font-bold uppercase tracking-widest text-orange-700">{options.companyName}</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{confirming ? 'Hoàn thiện danh sách container' : existing ? 'Chỉnh sửa yêu cầu đặt chỗ' : 'Hồ sơ xuất khẩu mới'}</h3></div></div>
        <div className="flex items-center gap-2"><span role="status" className="flex items-center gap-1.5 text-xs text-slate-500">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}{saveStatus}</span><button type="button" className={secondary} disabled={busy || saving || conflict} onClick={() => persist(content).catch(() => {})}><Save className="h-4 w-4" />Lưu nháp</button></div></div>
      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Các bước chuẩn bị">{steps.map((label, index) => <li key={label}><button type="button" disabled={busy || (confirming && index === 0)} onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`flex h-full w-full items-center gap-2 rounded-xl p-2.5 text-left text-xs transition sm:p-3 ${step === index ? 'bg-white font-bold text-orange-800 shadow-sm ring-1 ring-orange-200' : step > index ? 'text-teal-700 hover:bg-white/70' : 'text-slate-500 hover:bg-white/70'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step === index ? 'bg-orange-600 text-white' : 'border border-current'}`}>{step > index ? <Check className="h-3 w-3" /> : index + 1}</span><span>{label}</span></button></li>)}</ol>
    </div>
    <fieldset disabled={busy} className="min-w-0 space-y-5 p-5 sm:p-7" aria-busy={busy}>
      {error && <div role="alert" className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}{conflict ? <button type="button" onClick={reloadDraft} className="ml-2 font-bold underline">Thay nội dung đang nhập bằng nháp mới nhất</button> : existing && onResumeDraft && <button type="button" className="mt-2 block font-bold underline" onClick={async () => { try { await persist(latest.current); await onResumeDraft(meta.current.id) } catch (cause) { setError(errorText(cause)) } }}>Lưu nháp & lấy trạng thái hồ sơ mới nhất</button>}</div>}
      {step === 0 && <div className="space-y-5">
        {modeSelector}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Hãng tàu"><select className={input} value={content.shippingLineId || ''} onChange={event => patch({ shippingLineId: event.target.value || null, voyageId: null })}><option value="">Chọn hãng tàu</option>{options.shippingLines.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Chuyến tàu"><select className={input} value={content.voyageId || ''} disabled={!content.shippingLineId} onChange={event => patch({ voyageId: event.target.value || null })}><option value="">Chọn chuyến đang mở</option>{voyages.map(row => <option key={row.id} value={row.id}>{row.vesselName} · {row.voyageNumber} · {row.portOfDischarge}</option>)}</select></Field></div>
        {voyage && <div className="grid grid-cols-2 gap-3 rounded-2xl bg-sky-50 p-4 text-xs sm:grid-cols-4">{[['Mở nhận', voyage.receiveFrom], ['Hạn VGM', voyage.vgmCutoff], ['Hạn vào cảng (CY)', voyage.cyCutoff], ['Hạn SI', voyage.siCutoff]].map(([label, value]) => <div key={label}><p className="text-slate-500">{label}</p><p className="mt-1 font-bold text-sky-900">{date(value)}</p></div>)}</div>}
        <fieldset disabled={busy}><legend className="mb-3 text-sm font-bold">Bạn đã có số container chưa?</legend><div className="grid gap-3 sm:grid-cols-2">{[['containers', 'Đã có container', 'Chọn bản khai; tự điền loại, seal và hàng hóa.', Package], ['capacity', 'Chưa có container', 'Đặt chỗ theo loại và số lượng; bổ sung vỏ sau.', Clock]].map(([value, title, description, Icon]) => <label key={value} className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${content.mode === value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300'}`}><Icon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><span className="flex-1"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span></span><input type="radio" name={`${id}-source-mode`} checked={content.mode === value} onChange={() => patch({ mode: value })} className="accent-orange-600" /></label>)}</div></fieldset>
        {content.mode === 'capacity' && <div className="space-y-3 rounded-2xl border border-slate-200 p-4"><h4 className="text-sm font-bold">Nhu cầu thiết bị</h4>{content.equipmentRequests.map((row, index) => <div key={index} className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field label="Loại container"><select className={input} value={row.typeCode} onChange={event => patch({ equipmentRequests: content.equipmentRequests.map((r, i) => i === index ? { ...r, typeCode: event.target.value } : r) })}><option value="">Chọn loại</option>{options.containerTypes.map(type => <option key={type.code} value={type.code}>{type.code}</option>)}</select></Field></div><div className="w-24"><Field label="Số lượng"><input className={input} type="number" min="1" max="50" value={row.quantity} onChange={event => patch({ equipmentRequests: content.equipmentRequests.map((r, i) => i === index ? { ...r, quantity: Number(event.target.value) } : r) })} /></Field></div><button type="button" className={secondary} aria-label={`Bỏ nhu cầu dòng ${index + 1}`} onClick={() => patch({ equipmentRequests: content.equipmentRequests.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" className={secondary} disabled={content.equipmentRequests.length >= 20} onClick={() => patch({ equipmentRequests: [...content.equipmentRequests, { typeCode: '', quantity: 1 }] })}><Plus className="h-4 w-4" />Thêm loại container</button></div>}
        <Field label="Ghi chú hàng hóa / nhu cầu"><textarea rows="2" maxLength="1000" className={input} value={content.description} onChange={event => patch({ description: event.target.value })} placeholder="Thông tin bổ sung cho hãng tàu (nếu có)" /></Field>
      </div>}
      {step === 1 && <div className="space-y-5">
        {confirming && <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4" aria-label="Cơ cấu container được duyệt">
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-extrabold text-sky-900">Cơ cấu hãng tàu đã duyệt</h4><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-800">Đã chọn {content.containers.length}/{approvedQuantity} container</span></div>
          <table className="w-full text-left text-xs"><thead><tr className="border-b border-sky-100 text-slate-500"><th scope="col" className="py-2 font-semibold">Loại</th><th scope="col" className="py-2 text-center font-semibold">Được duyệt</th><th scope="col" className="py-2 text-center font-semibold">Đã chọn</th><th scope="col" className="py-2 text-right font-semibold">Cần bổ sung</th></tr></thead>
            <tbody>{equipmentRows.map(row => <tr key={row.typeCode} className="border-b border-sky-100 last:border-0"><th scope="row" className="py-2.5 font-bold text-sky-950">{row.typeCode || 'Chưa rõ loại'}</th><td className="py-2.5 text-center text-slate-600">{row.approved}</td><td className="py-2.5 text-center font-bold text-slate-800">{row.selected}</td><td className={`py-2.5 text-right font-semibold ${row.excess ? 'text-rose-700' : row.remaining ? 'text-amber-700' : 'text-teal-700'}`}>{row.excess ? `Vượt ${row.excess}` : row.remaining ? `Thiếu ${row.remaining}` : 'Đã đủ'}</td></tr>)}</tbody>
          </table><p className="text-xs leading-relaxed text-slate-500">Chọn đủ từng loại đã duyệt. Thông tin còn thiếu được giữ trong nháp để tiếp tục bổ sung.</p>
        </section>}
        {content.mode === 'containers' ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-base font-extrabold">Chọn container từ bản khai</h4><p className="mt-1 text-xs text-slate-500">{new Set(options.sources.map(row => row.containerId)).size} container khả dụng · Đã chọn {content.containers.length}/50 · Cùng loại hàng để ghép lô.</p></div><button type="button" className={secondary} onClick={() => setOpenGroups(openGroups.size === groups.length ? new Set() : new Set(groups.map(([type]) => type)))}>{openGroups.size === groups.length ? 'Thu gọn tất cả' : 'Mở tất cả'}</button></div>
          {sourcesLoading && <p role="status" className="text-sm text-slate-500">Đang kiểm tra container chưa được đặt…</p>}
          {sourcesError && <p role="alert" className="text-sm text-rose-700">Chưa tải được danh sách mới. Dùng nút Làm mới để kiểm tra lại.</p>}
          {!sourcesLoading && !groups.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Chưa có bản khai phù hợp. Bạn có thể xin đặt chỗ khi chưa có container.</p>}
          <div className="space-y-2">{groups.map(([type, group], index) => {
            const open = openGroups.has(type), count = content.containers.filter(row => row.cargoType === type).length, blocked = Boolean(cargo && cargo !== type)
            const selectedLimit = count >= Math.min(group.length, 50)
            return <section key={type} className={`overflow-hidden rounded-2xl border ${tones[index % tones.length]} ${blocked ? 'opacity-60' : ''}`}><button type="button" aria-expanded={open} aria-controls={`${id}-group-${type}`} onClick={() => toggleGroup(type)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><span><span className="text-sm font-bold">{cargoNames[type] || type}</span><span className="ml-2 rounded-full bg-white px-2 py-1 text-xs">{group.length} container{count > 0 ? ` · Chọn ${count}` : ''}</span></span><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} /></button>{open && <div id={`${id}-group-${type}`} className="space-y-3 border-t border-white p-3"><div className="flex justify-end"><button type="button" className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-teal-800 disabled:opacity-50" disabled={blocked || sourcesLoading || sourcesError} onClick={() => patch({ containers: selectedLimit ? [] : group.slice(0, 50).map(row => content.containers.find(c => c.containerId === row.containerId) || preparedSource(row)) })}>{selectedLimit ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}</button></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{group.map(row => <label key={preparationKey(row)} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition ${content.containers.some(c => c.containerId === row.containerId) ? 'border-orange-400 bg-white ring-1 ring-orange-200' : 'border-white bg-white/80 hover:border-orange-300'}`}><input type="checkbox" className="mt-0.5 accent-orange-600" checked={content.containers.some(c => c.containerId === row.containerId)} disabled={blocked || sourcesLoading || sourcesError || (!content.containers.some(c => c.containerId === row.containerId) && content.containers.length >= 50)} onChange={() => toggle(row)} /><span className="min-w-0"><span className="block text-xs font-bold">{row.containerNumber}</span><span className="mt-1 block text-[11px] text-slate-500">{row.containerTypeCode} · Seal {row.sealNumber || 'chưa khai'}</span></span></label>)}</div></div>}</section>
          })}</div>
          {content.containers.length > 0 && <div className="space-y-2"><h4 className="text-sm font-bold">Hồ sơ từng container <span className="font-normal text-slate-500">· {confirming ? 'Hoàn thiện trước khi gửi hãng tàu kiểm tra' : 'Có thể bổ sung VGM và chứng từ sau duyệt'}</span></h4>{content.containers.map(row => {
            const key = preparationKey(row), open = openRows.has(key)
            return <div key={key} className="rounded-2xl border border-slate-200"><button type="button" className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={() => setOpenRows(current => { const next = new Set(current); if (open) next.delete(key); else next.add(key); return next })}><Package className="h-4 w-4 text-orange-600" /><span className="flex-1 text-sm font-bold">{row.containerNumber} <span className="font-normal text-slate-500">· {row.containerTypeCode}</span></span><span className={`text-xs ${row.vgmKg > 0 ? 'text-teal-700' : 'text-amber-700'}`}>{row.vgmKg > 0 ? `VGM ${Number(row.vgmKg).toLocaleString('vi-VN')} kg` : 'Chưa có VGM'}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Số seal"><input className={input} value={row.sealNumber} maxLength="100" onChange={event => patchRow(key, { sealNumber: event.target.value })} /></Field><Field label="VGM đã xác minh (kg)"><input className={input} type="number" min="0.001" step="0.001" value={row.vgmKg ?? ''} onChange={event => patchRow(key, { vgmKg: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Từ kết quả cân thực tế" /></Field><div className="text-xs text-slate-500"><p className="font-semibold">Khối lượng khai báo</p><p className="mt-2 text-sm font-bold text-slate-700">{row.grossWeightKg == null ? 'Chưa có' : `${Number(row.grossWeightKg).toLocaleString('vi-VN')} kg`}</p><p className="mt-1">VGM lấy từ phiếu cân đã xác minh.</p></div>{row.cargoType === 'reefer' && <><Field label="Nhiệt độ bảo quản (°C)"><input className={input} type="number" step="0.1" value={row.targetTemperature ?? ''} onChange={event => patchRow(key, { targetTemperature: event.target.value === '' ? null : Number(event.target.value) })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange-600" checked={row.isReeferPowerRequired} onChange={event => patchRow(key, { isReeferPowerRequired: event.target.checked })} />Yêu cầu cấp điện tại bãi</label></>}{['dangerous', 'dangerous_goods'].includes(row.cargoType) && <><Field label="Mã UN"><input className={input} maxLength="30" value={row.unNumber || ''} onChange={event => patchRow(key, { unNumber: event.target.value })} /></Field><Field label="Phân lớp nguy hiểm"><input className={input} maxLength="30" value={row.dgClass || ''} onChange={event => patchRow(key, { dgClass: event.target.value })} /></Field></>}</div>}</div>
          })}</div>}
        </> : <div className="rounded-2xl bg-sky-50 p-5 text-sm text-sky-900"><h4 className="font-bold">Xin đặt chỗ cho {quantity} container</h4><p className="mt-2">Bạn sẽ bổ sung số container, seal và VGM sau khi hãng tàu xác nhận nhu cầu.</p></div>}
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-extrabold"><FileText className="h-4 w-4 text-orange-600" />Chứng từ xuất khẩu{cargo === 'reefer' ? ' · Hàng lạnh' : ''}</h4><p className="mt-1 text-xs text-slate-500">Tải một lần lên S3, dùng lại trong hồ sơ. {confirming ? 'Bổ sung chứng từ theo loại hàng.' : 'Có thể bổ sung sau khi hãng tàu duyệt đặt chỗ.'}</p></div>{content.containers.length > 0 && <select aria-label="Phạm vi chứng từ" className={`${input} sm:max-w-64`} value={scope} onChange={event => setScope(event.target.value)}><option value="shared">Dùng chung cho danh sách</option>{content.containers.map(row => <option key={preparationKey(row)} value={preparationKey(row)}>{row.containerNumber}</option>)}</select>}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{actualSpecs.map(spec => {
            const doc = docs.find(doc => doc.documentType === spec.documentType)
            return <div key={spec.documentType} className={`flex flex-col gap-3 rounded-2xl border p-4 ${doc ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-slate-50/50'}`}><div className="flex items-start justify-between gap-2"><h5 className="text-xs font-bold leading-relaxed">{spec.nameVi || spec.documentType}</h5>{doc ? <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" /> : <span className="shrink-0 text-[10px] text-slate-500">{spec.isMandatory ? 'Khi khai danh sách' : 'Bổ sung'}</span>}</div>{doc && <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-semibold text-teal-700 underline" title={doc.fileName}>{doc.fileName}</a>}<label className={`relative mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${uploading ? 'pointer-events-none bg-slate-100 text-slate-500' : 'bg-white text-orange-700 ring-1 ring-slate-200 hover:bg-orange-50'}`}>{uploading === spec.documentType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{uploading === spec.documentType ? 'Đang tải lên S3…' : doc ? 'Thay tệp chứng từ' : 'Tải tệp chứng từ'}<input type="file" className="sr-only" aria-label={`Tải ${spec.nameVi || spec.documentType}`} accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={event => upload(spec, event)} /></label>{doc && <button type="button" className="text-left text-[11px] text-slate-500 hover:text-rose-600" onClick={() => scope === 'shared' ? patch({ sharedDocuments: content.sharedDocuments.filter(d => d.documentType !== spec.documentType) }) : patchRow(scope, { documents: docs.filter(d => d.documentType !== spec.documentType) })}>Bỏ khỏi hồ sơ</button>}</div>
          })}</div>
          {content.containers.length > 1 && content.sharedDocuments.length > 0 && <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><input type="checkbox" className="mt-0.5 accent-orange-600" checked={content.sharedDocumentsConfirmed} onChange={event => { const checked = event.target.checked; dirty.current = true; setContent(current => ({ ...current, sharedDocumentsConfirmed: checked, sharedDocuments: current.sharedDocuments.map(doc => ({ ...doc, containerNumbers: checked ? current.containers.map(row => row.containerNumber) : [] })) })); setChecks(null) }} />Tôi đã đối chiếu tệp gốc: các chứng từ dùng chung thực sự bao gồm toàn bộ {content.containers.length} container đã chọn. Hồ sơ chờ nhân viên kiểm tra.</label>}
        </section>
      </div>}
      {step === 2 && <div className="space-y-4"><div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-teal-700" /><h4 className="text-base font-extrabold">{confirming ? 'Gửi danh sách để hãng tàu kiểm tra' : 'Kiểm tra nhu cầu trước khi gửi'}</h4></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Hãng tàu</dt><dd className="mt-1 font-bold">{options.shippingLines.find(row => row.id === content.shippingLineId)?.name || existing?.shippingLineName || 'Chưa chọn'}</dd></div><div><dt className="text-xs text-slate-500">Chuyến / cảng đến</dt><dd className="mt-1 font-bold">{voyage ? `${voyage.vesselName} · ${voyage.voyageNumber} → ${voyage.portOfDischarge}` : 'Chưa chọn'}</dd></div><div><dt className="text-xs text-slate-500">Thiết bị yêu cầu</dt><dd className="mt-1 font-bold">{demand.map(row => `${row.quantity} × ${row.typeCode || '?'}`).join(' · ') || 'Chưa có'}</dd></div><div><dt className="text-xs text-slate-500">Hồ sơ đang chuẩn bị</dt><dd className="mt-1 font-bold">{content.containers.length} số container · {content.sharedDocuments.length + content.containers.reduce((sum, row) => sum + row.documents.length, 0)} tệp chứng từ</dd></div></dl></div><p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">{confirming ? 'Hãng tàu kiểm tra phiên bản này và chuyển danh sách hợp lệ sang cảng. Bạn sẽ tối ưu xe, moóc, tài xế và khung giờ sau khi cảng tiếp nhận dữ liệu.' : 'Yêu cầu được gửi đến hãng tàu để duyệt đặt chỗ. Số container, VGM, chứng từ và lịch xe có thể hoàn thiện theo các bước tiếp theo.'}</p>{content.mode === 'containers' && <button type="button" className={secondary} disabled={checking || busy} onClick={runChecks}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Kiểm tra hồ sơ container</button>}{validChecks && <div role="status" className={`rounded-xl border p-4 text-sm ${validChecks.cargoReady ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-bold">{validChecks.cargoReady ? 'Hồ sơ container đủ thông tin để gửi kiểm tra.' : confirming ? 'Cần bổ sung trước khi gửi danh sách' : 'Có thể bổ sung sau khi đặt chỗ được duyệt'}</p>{validChecks.messages?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{validChecks.messages.map((message, index) => <li key={index}>{message}</li>)}</ul>}</div>}</div>}
    </fieldset>
    <div className="sticky bottom-3 z-10 mx-3 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:mx-5"><div className="text-xs text-slate-500"><p className="font-bold text-slate-800">{quantity} container{quantity >= 2 ? ' · Hồ sơ theo lô' : ''}</p><p className="mt-1">{confirming ? 'Hãng tàu kiểm tra → Cảng tiếp nhận → Lịch xe' : 'Gửi yêu cầu → Hãng tàu duyệt → Hoàn thiện hồ sơ'}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" className={secondary} disabled={busy} onClick={close}><X className="h-4 w-4" />Đóng</button>{step > (confirming ? 1 : 0) && <button type="button" className={secondary} disabled={busy} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" />Quay lại</button>}{step < 2 ? <button type="button" className={primary} disabled={busy} onClick={() => { setStep(step + 1); setError('') }}>Tiếp tục<ArrowRight className="h-4 w-4" /></button> : <button type="button" className={primary} disabled={busy || checking || conflict || (content.mode === 'containers' && sourcesError)} onClick={send}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{confirming ? 'Gửi danh sách hãng tàu' : 'Gửi yêu cầu đặt chỗ'}</button>}</div></div>
  </div>
}
