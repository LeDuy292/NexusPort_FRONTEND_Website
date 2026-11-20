import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManifestContainerEditor from './ManifestContainerEditor'
import ManifestContainerList from './ManifestContainerList'
import ManifestConfirmDialog from './ManifestConfirmDialog'
import { clearManifestComposerSession, saveManifestComposerSession } from '../utils/manifestComposerSession'
import { shippingLineApi, formatApiErrorMessage } from '../api/shippingLineApi'
import { importDocumentService } from '../../../services/importDocumentService'

const blankContainer = () => ({ containerNumber: '', isoType: '', isoSizeType: '', sealNumber: '', grossWeightKg: '', commodity: '', isReefer: false, lookupStatus: 'idle' })
const blankBill = () => ({ blNumber: '', shipper: '', consignee: '', containers: [] })
// Bản khai xuất: chuyến rời Cảng Tiên Sa (cảng bốc). Bản khai nhập: chuyến đến Cảng Tiên Sa (cảng dỡ).
const TIEN_SA = /TIÊN SA|TIEN SA|VNDAD/i
export const voyageFitsDirection = (voyage, direction) =>
  TIEN_SA.test(String(direction === 'IMPORT' ? voyage?.pod || '' : voyage?.pol || ''))
const fieldClass = 'w-full border border-chalk rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200'
const buttonClass = 'px-3 py-2 rounded-lg border border-chalk text-sm font-semibold hover:bg-fog disabled:opacity-50'

export default function ManifestComposer({ voyages, initialManifest, importedManifest, resumeSession, onClose, onSaved }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => resumeSession?.form || importedManifest || initialManifest || {
    requestKey: crypto.randomUUID(), voyageNumber: voyages.find(v => voyageFitsDirection(v, 'EXPORT'))?.voyageNumber || '',
    vesselName: voyages.find(v => voyageFitsDirection(v, 'EXPORT'))?.vesselName || '', direction: 'EXPORT', bills: [],
  })
  const [editingBill, setEditingBill] = useState(() => resumeSession?.editingBill || null)
  const [billIndex, setBillIndex] = useState(resumeSession?.billIndex ?? null)
  const [containerEditor, setContainerEditor] = useState(() => resumeSession?.containerEditor || null)
  const [containerPage, setContainerPage] = useState(resumeSession?.containerPage || 1)
  const [error, setError] = useState('')
  const [blError, setBlError] = useState('')
  const editingBillRef = useRef(null)
  editingBillRef.current = editingBill
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(Boolean(importedManifest || resumeSession))
  const [confirmation, setConfirmation] = useState(null)
  // Người gửi / nhận hàng phải là công ty có tài khoản Transport Company trên hệ thống
  const [companies, setCompanies] = useState([])
  const [companyError, setCompanyError] = useState('')
  useEffect(() => {
    importDocumentService.listCompanies()
      .then(list => setCompanies(Array.isArray(list) ? list : []))
      .catch(() => setCompanyError('Không tải được danh sách công ty vận tải.'))
  }, [])
  const update = (patch) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }
  const openBill = (index = null) => {
    setBillIndex(index)
    setEditingBill(index === null ? blankBill() : structuredClone(form.bills[index]))
    setContainerPage(1)
    setContainerEditor(null)
    setError('')
    setBlError('')
  }
  const openContainer = (index = null) => setContainerEditor({ index, value: index === null ? blankContainer() : structuredClone(editingBill.containers[index]) })
  const saveContainer = (container) => {
    const index = containerEditor.index
    if (editingBill.containers.some((c, i) => i !== index && c.containerNumber === container.containerNumber)) throw new Error('Container đã có trong vận đơn này.')
    if (form.bills.some((b, i) => i !== billIndex && b.containers.some(c => c.containerNumber === container.containerNumber))) throw new Error('Container đã được thêm vào một vận đơn khác trong bản khai.')
    const next = index === null ? [...editingBill.containers, container] : editingBill.containers.map((c, i) => i === index ? container : c)
    setEditingBill(b => ({ ...b, containers: next }))
    setContainerPage(Math.floor((index ?? next.length - 1) / 10) + 1)
    setContainerEditor(null)
    setError('')
  }
  const removeContainer = (index) => {
    setConfirmation({
      title: 'Xóa container khỏi vận đơn?',
      message: `Container ${editingBill.containers[index].containerNumber || ''} sẽ được bỏ khỏi vận đơn đang nhập.`,
      confirmLabel: 'Xóa container', danger: true,
      action: () => {
        setEditingBill(b => ({ ...b, containers: b.containers.filter((_, i) => i !== index) }))
        setContainerPage(page => Math.min(page, Math.max(1, Math.ceil((editingBill.containers.length - 1) / 10))))
      },
    })
  }
  const removeBill = index => {
    const bill = form.bills[index]
    setConfirmation({ title: 'Xóa vận đơn khỏi bản khai?',
      message: `Vận đơn ${bill.blNumber} và ${bill.containers.length} container sẽ được bỏ khỏi bản khai đang nhập.`,
      confirmLabel: 'Xóa vận đơn', danger: true,
      action: () => update({ bills: form.bills.filter((_, i) => i !== index) }),
    })
  }
  const registerContainer = (number, container) => {
    try {
      saveManifestComposerSession({ form, editingBill, billIndex, initialManifest, containerPage, containerEditor: { ...containerEditor, value: container } })
      navigate(`/shipping-line/containers?returnTo=manifest&containerNumber=${encodeURIComponent(number)}`)
    } catch { throw new Error('Không thể lưu tạm vận đơn trên trình duyệt. Vui lòng cho phép lưu trữ và thử lại.') }
  }
  const validateBlNumber = (value) => {
    const bl = value.trim().toUpperCase()
    if (!bl) return 'Nhập số vận đơn.'
    // Cùng quy tắc với bước phát hành vận đơn (blImport.service.js), để lỗi hiện ngay khi nhập
    if (!/^[A-Z0-9][A-Z0-9\-/]{5,34}$/.test(bl.replace(/\s+/g, ''))) return 'Số vận đơn không hợp lệ: cần 6–35 ký tự gồm chữ, số, dấu - hoặc /.'
    if (form.bills.some((b, i) => i !== billIndex && b.blNumber.trim().toUpperCase() === bl)) return 'Số vận đơn đã có trong bản khai.'
    return ''
  }
  // Kiểm tra cục bộ trước, rồi hỏi backend xem số vận đơn đã dùng ở bản khai khác của tài khoản chưa
  const checkBlNumber = async (value) => {
    const local = validateBlNumber(value)
    setBlError(local)
    if (local) return
    const bl = value.trim().toUpperCase()
    try {
      const res = await shippingLineApi.checkManifestBill(bl, initialManifest?.id)
      if (res && res.available === false) setBlError(current => (editingBillRef.current?.blNumber.trim().toUpperCase() === bl ? 'Số vận đơn đã được sử dụng trong bản khai khác.' : current))
    } catch {
      // Không chặn người dùng nếu không kiểm tra được; backend vẫn kiểm tra lại khi lưu.
    }
  }
  const saveBill = (event) => {
    event.preventDefault()
    const blProblem = validateBlNumber(editingBill.blNumber) || blError
    if (blProblem) { setBlError(blProblem); return }
    if (!editingBill.containers.length) { setError('Thêm ít nhất một container vào vận đơn.'); return }
    const invalidIndex = editingBill.containers.findIndex(c => !c.containerId || !c.sealNumber?.trim() || !c.commodity?.trim() || !(Number(c.grossWeightKg) > 0 && Number(c.grossWeightKg) <= 36000))
    if (invalidIndex >= 0) {
      setError(`Vui lòng hoàn tất thông tin container ${invalidIndex + 1}.`)
      openContainer(invalidIndex)
      return
    }
    const bill = { ...editingBill, blNumber: editingBill.blNumber.trim().toUpperCase() }
    if (form.bills.some((b, i) => i !== billIndex && b.blNumber.trim().toUpperCase() === bill.blNumber)) {
      setError('Số vận đơn đã có trong bản khai.'); return
    }
    update({ bills: billIndex === null ? [...form.bills, bill] : form.bills.map((b, i) => i === billIndex ? bill : b) })
    setEditingBill(null)
    setError('')
  }
  const save = async (isDraft) => {
    if (!form.voyageNumber.trim() || !form.vesselName.trim() || !form.bills.length) {
      setError('Chọn chuyến tàu và thêm ít nhất một vận đơn có container.'); return
    }
    setSaving(true); setError('')
    try {
      const payload = { ...form, isDraft, bills: form.bills.map(b => ({ ...b, containers: b.containers.map(c => ({ ...c, grossWeightKg: Number(c.grossWeightKg) })) })) }
      const document = initialManifest ? await shippingLineApi.updateManifest(initialManifest.id, payload) : await shippingLineApi.createManifest(payload)
      clearManifestComposerSession()
      onSaved(document)
    } catch (e) { setError(formatApiErrorMessage(e, 'Không thể lưu bản khai. Vui lòng thử lại.')) }
    finally { setSaving(false) }
  }
  const close = () => {
    if (saving) return
    const discard = () => { clearManifestComposerSession(); onClose() }
    if (!dirty && !editingBill) { discard(); return }
    setConfirmation({ title: 'Bỏ các thay đổi chưa lưu?',
      message: 'Thông tin bạn đang nhập chưa được lưu. Bạn muốn tiếp tục chỉnh sửa hay đóng bản khai?',
      cancelLabel: 'Tiếp tục chỉnh sửa', confirmLabel: 'Bỏ thay đổi và đóng', action: discard,
    })
  }
  const total = form.bills.reduce((sum, b) => sum + b.containers.length, 0)
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6">
      <section role="dialog" aria-modal={!containerEditor && !confirmation} aria-hidden={containerEditor || confirmation ? true : undefined} inert={Boolean(containerEditor)} aria-labelledby="manifest-composer-title" className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[94vh] flex flex-col">
        <header className="p-5 border-b border-chalk flex items-start justify-between gap-4">
          <div><h2 id="manifest-composer-title" className="text-xl font-bold">{editingBill ? 'Thêm thông tin vận đơn' : initialManifest ? 'Tiếp tục bản khai nháp' : importedManifest ? 'Xem lại bản khai từ Excel' : 'Tạo bản khai Manifest mới'}</h2>
            <p className="text-sm text-slate mt-1">Manifest → Vận đơn → Container</p></div>
          <button type="button" onClick={close} disabled={saving} aria-label="Đóng" className={buttonClass}>✕</button>
        </header>
        <div className="overflow-y-auto p-5 space-y-5">
          {error && <p role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg whitespace-pre-line">{error}</p>}
          {editingBill ? (
            <form id="manifest-bill-form" onSubmit={saveBill} className="space-y-5">
              <div className="grid md:grid-cols-3 gap-4">
                <label className="text-sm font-semibold space-y-1 block">Số vận đơn (B/L) *<input required maxLength={100} aria-invalid={Boolean(blError)} aria-describedby={blError ? 'bl-number-error' : undefined} className={`${fieldClass} ${blError ? 'border-red-400' : ''}`} value={editingBill.blNumber} onChange={e => { const v = e.target.value; setEditingBill(b => ({ ...b, blNumber: v })); if (blError) setBlError(validateBlNumber(v)) }} onBlur={e => checkBlNumber(e.target.value)} />{blError && <span id="bl-number-error" role="alert" className="block text-xs font-medium text-red-600">{blError}</span>}</label>
                {[['shipper', 'Người gửi hàng'], ['consignee', 'Người nhận hàng']].map(([key, label]) => {
                  const current = editingBill[key]
                  const known = companies.some(c => c.companyName === current)
                  return (
                    <label key={key} className="text-sm font-semibold space-y-1 block">{label} *
                      <select required className={fieldClass} value={current} onChange={e => setEditingBill(b => ({ ...b, [key]: e.target.value }))}>
                        <option value="">Chọn công ty vận tải</option>
                        {current && !known && <option value={current}>{current} (chưa đăng ký, chọn lại)</option>}
                        {companies.map(c => <option key={c.id} value={c.companyName}>{c.companyName}{c.taxCode ? ` · MST ${c.taxCode}` : ''}</option>)}
                      </select>
                    </label>
                  )
                })}
              </div>
              {companyError && <p role="alert" className="text-xs text-red-700">{companyError}</p>}
              {!companyError && companies.length === 0 && <p className="text-xs text-slate">Chưa có công ty nào có tài khoản Transport Company trên hệ thống.</p>}
              <div className="flex flex-wrap justify-between items-center gap-3"><div><h3 className="font-bold">Container trong vận đơn ({editingBill.containers.length})</h3><p className="mt-1 text-xs text-slate">10 container / trang · Chọn Sửa để xem và chỉnh thông tin chi tiết.</p></div>
                <button type="button" className={buttonClass} onClick={() => openContainer()}>+ Thêm container</button></div>
              <ManifestContainerList containers={editingBill.containers} page={containerPage} onPageChange={setContainerPage} onEdit={openContainer} onRemove={removeContainer} />
            </form>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-semibold">Chuyến tàu *<select className={fieldClass} value={form.voyageNumber} onChange={e => { const v = voyages.find(v => v.voyageNumber === e.target.value); update({ voyageNumber: e.target.value, vesselName: v?.vesselName || '' }) }}><option value="">Chọn chuyến tàu</option>
                  {form.voyageNumber && !voyages.some(v => v.voyageNumber === form.voyageNumber) && <option value={form.voyageNumber}>{form.voyageNumber} · {form.vesselName}</option>}
                  {voyages.filter(v => voyageFitsDirection(v, form.direction)).map(v => <option key={v.id || v.voyageNumber} value={v.voyageNumber}>{v.voyageNumber} · {v.vesselName} · {form.direction === 'IMPORT' ? `từ ${v.pol || '—'}` : `đi ${v.pod || '—'}`}</option>)}
                </select></label>
                <label className="text-sm font-semibold">Hướng khai<select className={fieldClass} value={form.direction} onChange={e => {
                  const direction = e.target.value
                  const current = voyages.find(v => v.voyageNumber === form.voyageNumber)
                  update(current && voyageFitsDirection(current, direction) ? { direction } : { direction, voyageNumber: '', vesselName: '' })
                }}><option value="EXPORT">Xuất khẩu</option><option value="IMPORT">Nhập khẩu</option></select></label>
              </div>
              <div className="flex justify-between items-center gap-3"><h3 className="font-bold">{form.bills.length} vận đơn · {total} container</h3><button type="button" className={buttonClass} onClick={() => openBill()}>+ Tạo thêm vận đơn</button></div>
              {!form.bills.length && <div className="p-8 text-center border border-dashed border-chalk rounded-xl text-slate">Thêm vận đơn, sau đó khai báo các container và hàng hóa trong vận đơn đó.</div>}
              {form.bills.map((b, i) => <article key={i} className="border border-chalk rounded-xl overflow-hidden">
                <div className="p-4 bg-fog flex flex-wrap justify-between gap-3 items-center"><div><h4 className="font-bold">B/L {b.blNumber}</h4><p className="text-sm text-slate">{b.shipper} → {b.consignee}</p></div><div className="flex gap-2"><button type="button" className={buttonClass} onClick={() => openBill(i)}>Sửa vận đơn</button><button type="button" className={buttonClass} onClick={() => removeBill(i)}>Xóa</button></div></div>
                <details className="p-4"><summary className="cursor-pointer text-sm font-semibold text-slate">Danh sách container ({b.containers.length})</summary><div className="mt-3"><ManifestContainerList containers={b.containers} /></div></details>
              </article>)}
            </>
          )}
        </div>
        <footer className="p-5 border-t border-chalk flex justify-end gap-3">
          {editingBill ? <><button type="button" className={buttonClass} onClick={() => { setEditingBill(null); setError('') }}>Hủy sửa vận đơn</button><button form="manifest-bill-form" type="submit" className="px-4 py-2 rounded-lg bg-signal-orange text-white font-bold">Thêm vào bản khai</button></> : <>
            <button type="button" disabled={saving} className={buttonClass} onClick={close}>Đóng</button>
            <button type="button" disabled={saving} className={buttonClass} onClick={() => save(true)}>Lưu nháp</button>
            <button type="button" disabled={saving} className="px-4 py-2 rounded-lg bg-signal-orange text-white font-bold disabled:opacity-50" onClick={() => save(false)}>{saving ? 'Đang lưu…' : 'Hoàn tất bản khai'}</button>
          </>}
        </footer>
      </section>
      {containerEditor && <ManifestContainerEditor initialValue={containerEditor.value} editing={containerEditor.index !== null}
        onClose={() => setContainerEditor(null)} onSave={saveContainer} onRegister={registerContainer} />}
      {confirmation && <ManifestConfirmDialog {...confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => {
        const action = confirmation.action
        setConfirmation(null)
        action()
      }} />}
    </div>
  )
}
