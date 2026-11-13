import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManifestContainerEditor from './ManifestContainerEditor'
import ManifestContainerList from './ManifestContainerList'
import ManifestConfirmDialog from './ManifestConfirmDialog'
import { clearManifestComposerSession, saveManifestComposerSession } from '../utils/manifestComposerSession'
import { shippingLineApi, formatApiErrorMessage } from '../api/shippingLineApi'

const blankContainer = () => ({ containerNumber: '', isoType: '', isoSizeType: '', sealNumber: '', grossWeightKg: '', commodity: '', isReefer: false, lookupStatus: 'idle' })
const blankBill = () => ({ blNumber: '', shipper: '', consignee: '', containers: [] })
const fieldClass = 'w-full border border-chalk rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-200'
const buttonClass = 'px-3 py-2 rounded-lg border border-chalk text-sm font-semibold hover:bg-fog disabled:opacity-50'

export default function ManifestComposer({ voyages, initialManifest, importedManifest, resumeSession, onClose, onSaved }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => resumeSession?.form || importedManifest || initialManifest || {
    requestKey: crypto.randomUUID(), voyageNumber: voyages[0]?.voyageNumber || '',
    vesselName: voyages[0]?.vesselName || '', direction: 'EXPORT', bills: [],
  })
  const [editingBill, setEditingBill] = useState(() => resumeSession?.editingBill || null)
  const [billIndex, setBillIndex] = useState(resumeSession?.billIndex ?? null)
  const [containerEditor, setContainerEditor] = useState(() => resumeSession?.containerEditor || null)
  const [containerPage, setContainerPage] = useState(resumeSession?.containerPage || 1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(Boolean(importedManifest || resumeSession))
  const [confirmation, setConfirmation] = useState(null)
  const update = (patch) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }
  const openBill = (index = null) => {
    setBillIndex(index)
    setEditingBill(index === null ? blankBill() : structuredClone(form.bills[index]))
    setContainerPage(1)
    setContainerEditor(null)
    setError('')
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
  const saveBill = (event) => {
    event.preventDefault()
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
                {[['blNumber', 'Số vận đơn (B/L)', 100], ['shipper', 'Người gửi hàng', 500], ['consignee', 'Người nhận hàng', 500]].map(([key, label, max]) => (
                  <label key={key} className="text-sm font-semibold space-y-1 block">{label} *<input required maxLength={max} className={fieldClass} value={editingBill[key]} onChange={e => setEditingBill(b => ({ ...b, [key]: e.target.value }))} /></label>
                ))}
              </div>
              <div className="flex flex-wrap justify-between items-center gap-3"><div><h3 className="font-bold">Container trong vận đơn ({editingBill.containers.length})</h3><p className="mt-1 text-xs text-slate">10 container / trang · Chọn Sửa để xem và chỉnh thông tin chi tiết.</p></div>
                <button type="button" className={buttonClass} onClick={() => openContainer()}>+ Thêm container</button></div>
              <ManifestContainerList containers={editingBill.containers} page={containerPage} onPageChange={setContainerPage} onEdit={openContainer} onRemove={removeContainer} />
            </form>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-semibold">Chuyến tàu *<select className={fieldClass} value={form.voyageNumber} onChange={e => { const v = voyages.find(v => v.voyageNumber === e.target.value); update({ voyageNumber: e.target.value, vesselName: v?.vesselName || '' }) }}><option value="">Chọn chuyến tàu</option>
                  {form.voyageNumber && !voyages.some(v => v.voyageNumber === form.voyageNumber) && <option value={form.voyageNumber}>{form.voyageNumber} · {form.vesselName}</option>}
                  {voyages.map(v => <option key={v.id || v.voyageNumber} value={v.voyageNumber}>{v.voyageNumber} · {v.vesselName}</option>)}
                </select></label>
                <label className="text-sm font-semibold">Hướng khai<select className={fieldClass} value={form.direction} onChange={e => update({ direction: e.target.value })}><option value="EXPORT">Xuất khẩu</option><option value="IMPORT">Nhập khẩu</option></select></label>
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
