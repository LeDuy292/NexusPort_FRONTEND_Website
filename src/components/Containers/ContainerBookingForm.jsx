import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { containerService } from '../../services/containerService'
import { bookingService } from '../../services/bookingService'

const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-4 py-3 text-sm outline-none focus:border-signal-orange focus:bg-white'
const message = e => {
  const body = e.response?.data
  const errors = body?.errors || body?.Errors
  return errors ? Object.values(errors).flat().join(' ') : body?.message || body?.Message || e.message
}

export default function ContainerBookingForm({ onSaved, onClose }) {
  const { state: context } = useLocation()
  const [selected, setSelected] = useState(null)
  const [fleet, setFleet] = useState({ trucks: [], drivers: [] })
  const [form, setForm] = useState({ bookingType: context?.bookingType || 'Dropoff', truckId: '', driverId: '', bookingCode: `BK-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, appointmentDate: '', startTime: '', endTime: '' })
  const [yardCode, setYardCode] = useState(context?.yardCode || '')
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const [saved, setSaved] = useState(null)
  const aiRequest = useRef(0)
  const [aiMatching, setAiMatching] = useState(false)
  const [aiRecommendation, setAiRecommendation] = useState(null)
  const [backendPayload, setBackendPayload] = useState(null)
  const wizardStep = step, setWizardStep = setStep, actionLoading = busy
  const availableResources = fleet
  const selectedTruck = fleet.trucks.find(t => t.id === form.truckId)
  const validationErrors = error ? [error] : []
  const translateValidationError = text => text
  const showNotification = text => setError(text)
  const triggerBackendAiRecommendation = useCallback(async () => {
    const requestId = ++aiRequest.current
    if (!selected) return
    setAiMatching(true); setError(''); setAiRecommendation(null); setBackendPayload(null)
    try {
      const rec = await bookingService.getSelectionRecommendation({ containerId: selected.containerId, bookingType: form.bookingType,
        ...(form.bookingType === 'Pickup' ? { yardCode: yardCode.trim() } : { declarationId: selected.declarationId }) })
      if (requestId !== aiRequest.current) return
      setAiRecommendation(rec)
      setBackendPayload({ ratio: rec.payloadRatio, status: rec.payloadStatus, severity: rec.payloadSeverity, warningMessage: rec.payloadMessage, isSafe: rec.payloadStatus !== 'Overloaded' })
      setForm(prev => ({ ...prev, truckId: rec.recommendedTruckId || '', driverId: rec.recommendedDriverId || '',
        containerGrossWeightTon: rec.containerGrossWeightTon, cargoType: rec.cargoType,
        appointmentDate: rec.recommendedDate || prev.appointmentDate, startTime: rec.recommendedStartTime || prev.startTime, endTime: rec.recommendedEndTime || prev.endTime }))
    } catch (e) { if (requestId === aiRequest.current) setError(message(e)) }
    finally { if (requestId === aiRequest.current) setAiMatching(false) }
  }, [selected, form.bookingType, yardCode])
  useEffect(() => {
    const requests = aiRequest
    ++requests.current; setAiMatching(false); setAiRecommendation(null); setBackendPayload(null)
    setForm(prev => ({ ...prev, containerGrossWeightTon: form.bookingType === 'Dropoff' && selected?.grossWeightKg != null ? Number(selected.grossWeightKg) / 1000 : null, cargoType: form.bookingType === 'Dropoff' ? selected?.cargoTypeName || '' : '', sealNumber: form.bookingType === 'Dropoff' ? selected?.sealNumber || '' : '' }))
    const eligible = selected && (form.bookingType === 'Dropoff' ? selected.declarationId : /^(?:TC|YARD)-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(yardCode.trim()))
    if (!eligible) return undefined
    const timer = setTimeout(() => triggerBackendAiRecommendation(), 350)
    return () => { clearTimeout(timer); ++requests.current }
  }, [selected, form.bookingType, yardCode, triggerBackendAiRecommendation])
  const handleTruckChange = async truckId => {
    const truck = fleet.trucks.find(t => t.id === truckId)
    setForm(prev => ({ ...prev, truckId, ...(truck?.driverId ? { driverId: truck.driverId } : {}) })); setBackendPayload(null)
    // No master cargo lookup: evaluate the exact declaration/code already analyzed.
    if (form.containerGrossWeightTon == null || !truckId || (form.bookingType === 'Pickup' && !aiRecommendation)) return
    try {
      const result = await bookingService.evaluatePayload({ truckId, customGrossWeightTon: form.containerGrossWeightTon })
      setBackendPayload({ ratio: result.payloadRatio, status: result.status, severity: result.severity, warningMessage: result.warningMessage, isSafe: result.isSafe })
    } catch (e) { setError(message(e)) }
  }
  useEffect(() => {
    let live = true
    setLoading(true)
    const load = async () => {
      try {
        const resources = await bookingService.getAvailableResources()
        const identity = context?.containerNumber ? await containerService.lookup(context.containerNumber) : null
        let declaration = null
        if (context?.declarationId) {
          const rows = await containerService.getTransportDeclarations(context.containerNumber)
          declaration = rows.find(row => row.id === context.declarationId)
          if (!declaration || declaration.isBooked) throw new Error('Khai báo này đã được đặt lịch hoặc không còn khả dụng. Vui lòng chọn lại tại trang khai báo container.')
        }
        if (live) {
          setFleet(resources); setSelected(identity ? { ...identity, ...declaration, containerId: identity.id, declarationId: declaration?.id } : null)
          setForm(prev => ({ ...prev, selectedContainerId: identity?.id, containerNo: identity?.containerNumber,
            sealNumber: declaration?.sealNumber || '', containerSize: identity?.containerTypeCode,
            cargoType: declaration?.cargoTypeName || '', containerGrossWeightTon: declaration?.grossWeightKg == null ? null : Number(declaration.grossWeightKg) / 1000 }))
        }
      } catch (e) { if (live) setError(message(e)) }
      finally { if (live) setLoading(false) }
    }
    load()
    return () => { live = false }
  }, [context?.containerNumber, context?.declarationId])
  const save = async event => {
    event.preventDefault(); setError('')
    if (step === 1) { setStep(2); return }
    setBusy(true)
    try {
      if (!selected) throw new Error('Chọn container tại trang khai báo trước khi đặt lịch.')
      if (form.bookingType === 'Dropoff' && !selected.declarationId) throw new Error('Chọn khai báo chưa đặt lịch tại trang khai báo container.')
      if (form.bookingType === 'Pickup' && !yardCode.trim()) throw new Error('Nhập mã lượt bãi nhận được khi đặt Dropoff.')
      const start = new Date(`${form.appointmentDate}T${form.startTime}`), end = new Date(`${form.appointmentDate}T${form.endTime}`)
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new Error('Khung giờ hẹn không hợp lệ.')
      const booking = await bookingService.createBooking({
        bookingCode: form.bookingCode,
        bookingType: form.bookingType, driverId: form.driverId || null, truckId: form.truckId || null,
        appointmentStart: start.toISOString(), appointmentEnd: end.toISOString(),
        containerSelections: [{ containerId: selected.containerId,
          ...(form.bookingType === 'Pickup' ? { yardCode: yardCode.trim().toUpperCase() } : { declarationId: selected.declarationId }) }],
      })
      setSaved(booking); onSaved?.(booking)
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const continuePickup = () => {
    setYardCode(saved.containerSelections?.[0]?.yardCode || '')
    setForm(old => ({ ...old, bookingType: 'Pickup', truckId: '', driverId: '', bookingCode: `BK-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, appointmentDate: '', startTime: '', endTime: '' }))
    setAiRecommendation(null); setBackendPayload(null); setStep(1); setSaved(null); setError(''); setCopyNotice('')
  }
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); setCopyNotice('Đã sao chép mã lượt bãi.') }
    catch { setCopyNotice('Chưa sao chép được. Bạn có thể chọn mã và sao chép thủ công.') }
  }
  const paste = async () => {
    try { setYardCode((await navigator.clipboard.readText()).trim().toUpperCase()); setError('') }
    catch { setError('Hãy dán mã vào ô bằng Ctrl+V hoặc thao tác Dán trên thiết bị.') }
  }
  if (saved) {
    const info = saved.containerSelections?.[0]
    const isDropoff = saved.bookingType === 'Dropoff'
    return <div className="mx-auto max-w-xl rounded-3xl border border-chalk bg-white p-8 shadow-sm" role="status">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><span className="material-symbols-outlined text-3xl">check_circle</span></div>
      <h2 className="font-heading text-2xl font-extrabold">Booking {isDropoff ? 'Dropoff' : 'Pickup'} thành công!</h2>
      <p className="mt-2 text-sm text-slate">{saved.bookingCode} · Chờ điều độ duyệt lịch hẹn.</p>
      <dl className="my-6 space-y-2 text-sm"><div>Container: <b>{info?.containerNumber || selected?.containerNumber}</b></div><div>Loại: {info?.containerTypeCode || selected?.containerTypeCode} · {info?.cargoTypeName || selected?.cargoTypeName || '—'}</div><div>Thời gian đặt: {new Date(saved.createdAt).toLocaleString('vi-VN')}</div></dl>
      {isDropoff && info?.yardCode && <><div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4"><span className="material-symbols-outlined text-signal-orange">key</span><strong className="select-all break-all font-mono text-lg tracking-wide">{info.yardCode}</strong><button onClick={() => copy(info.yardCode)} className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-bold">Copy</button></div><p className="mt-4 text-sm leading-relaxed text-slate">Dùng mã này khi đặt Pickup. Nếu công ty khác lấy container, gửi mã này cho họ. Chỉ chia sẻ mã cho bên được phép nhận.</p>{copyNotice && <p className="mt-2 text-xs">{copyNotice}</p>}</>}
      <div className="mt-7 flex flex-wrap justify-end gap-3">{isDropoff && info?.yardCode && <button onClick={continuePickup} className="rounded-xl bg-signal-orange px-5 py-3 text-sm font-bold text-white">Đặt Pickup ngay</button>}{!isDropoff && <Link to="/cargo" className="rounded-xl bg-signal-orange px-5 py-3 text-sm font-bold text-white">Chọn container cho lần tiếp theo</Link>}<button onClick={onClose} className="rounded-xl border border-chalk px-5 py-3 text-sm font-bold">Đóng</button></div>
    </div>
  }
  const handleCreateBooking = save
  return (
        <div className="bg-paper border border-chalk rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-200">

          {/* STEPPER HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-chalk">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-signal-orange uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Quy Trình Khởi Tạo Lịch Hẹn
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-extrabold text-carbon">
                Đăng Ký Cuộc Hẹn Kho Bãi
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống tự động đề xuất tổ hợp Xe đầu kéo - Tài xế - Khung giờ tối ưu nhằm hạn chế ùn tắc cổng.
              </p>
            </div>

            {/* Stepper Steps Navigation */}
            <div className="flex items-center gap-3 bg-fog p-1.5 rounded-2xl border border-chalk w-fit">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wizardStep === 1
                    ? 'bg-gradient-to-r from-signal-orange to-orange-600 text-white shadow-md shadow-orange-500/25'
                    : 'text-slate-600 hover:text-carbon'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  wizardStep === 1 ? 'bg-white/20 text-white font-black' : 'bg-slate-200 text-slate-700'
                }`}>
                  1
                </span>
                <span>Hàng Hóa & Phối Xe</span>
              </button>

              <div className="w-4 h-0.5 bg-chalk"></div>

              <button
                type="button"
                onClick={() => {
                  if (form.selectedContainerId || form.containerNo) {
                    setWizardStep(2)
                  } else {
                    showNotification('Vui lòng chọn container trước khi chuyển sang bước 2!', 'error')
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wizardStep === 2
                    ? 'bg-gradient-to-r from-signal-orange to-orange-600 text-white shadow-md shadow-orange-500/25'
                    : 'text-slate-600 hover:text-carbon'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  wizardStep === 2 ? 'bg-white/20 text-white font-black' : 'bg-slate-200 text-slate-700'
                }`}>
                  2
                </span>
                <span>Khung Giờ & Xác Nhận</span>
              </button>
            </div>
          </div>

          {/* Validation Alert */}
          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 text-xs text-rose-900 space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-2 text-rose-700 text-sm">
                <span className="material-symbols-outlined text-lg">gpp_bad</span>
                Yêu cầu Đặt chỗ chưa thỏa mãn các quy tắc nghiệp vụ cảng:
              </div>
              <ul className="list-disc list-inside space-y-1 font-medium pl-1 text-rose-800">
                {validationErrors.map((msg, i) => (
                  <li key={i}>{translateValidationError(msg)}</li>
                ))}
              </ul>
            </div>
          )}

          {!selected && <div className="rounded-2xl border border-dashed border-chalk p-8 text-center"><p className="mb-4 text-sm text-slate">{loading ? 'Đang tải thông tin…' : 'Chọn container tại trang khai báo trước khi đặt lịch.'}</p><Link to="/cargo" className="inline-block rounded-xl bg-signal-orange px-5 py-3 text-sm font-bold text-white">Đến khai báo container</Link></div>}
          <form onSubmit={handleCreateBooking}>

            {/* STEP 1: CONTAINER & FLEET AI AUTO-MATCH */}
            {wizardStep === 1 && selected && (
              <div className="space-y-6">

                {/* 1. TRANSACTION TYPE */}
                <div className="space-y-3">
                  <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                    1. Loại Giao Dịch Nghiệp Vụ Cảng (Booking Type)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => { setForm({ ...form, bookingType: 'Pickup' }); setAiRecommendation(null); setBackendPayload(null) }}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                        form.bookingType === 'Pickup'
                          ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                          : 'border-chalk hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        form.bookingType === 'Pickup' ? 'bg-signal-orange text-white' : 'bg-fog text-indigo-600'
                      }`}>
                        <span className="material-symbols-outlined text-2xl">arrow_upward</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-extrabold text-carbon text-base">Pickup</span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            Lấy container ra khỏi bãi
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Xe đến nhận đúng container và lượt bãi theo mã do bên đưa vào cung cấp.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => selected?.declarationId ? (setForm({ ...form, bookingType: 'Dropoff' }), setAiRecommendation(null), setBackendPayload(null)) : setError('Chọn khai báo chưa đặt lịch tại trang khai báo container để đặt Dropoff.')}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                        form.bookingType === 'Dropoff'
                          ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                          : 'border-chalk hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        form.bookingType === 'Dropoff' ? 'bg-signal-orange text-white' : 'bg-fog text-teal-600'
                      }`}>
                        <span className="material-symbols-outlined text-2xl">arrow_downward</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-extrabold text-carbon text-base">Dropoff</span>
                          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Hạ container vào bãi cảng
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Xe đầu kéo chở container hàng xuất khẩu hoặc vỏ cont rỗng vào bãi cảng lưu kho chờ bốc lên tàu.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CORE CONTAINER SELECTION */}
                <div className="bg-gradient-to-br from-fog to-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-chalk pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-signal-orange"></span>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-carbon">
                        2. Container Đã Chọn Từ Khai Báo
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Đúng container và lần giao nhận đã chọn
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-chalk bg-white p-4"><b className="font-mono">{form.containerNo || 'Chưa chọn container'}</b><Link to="/cargo" className="text-xs font-bold text-signal-orange underline">Chọn tại trang khai báo</Link></div>
                  {form.bookingType === 'Pickup' && <label className="block space-y-2 text-xs font-bold text-slate"><span>Mã lượt bãi *</span><div className="flex gap-2"><input required maxLength={32} autoComplete="off" spellCheck={false} className={`${inputClass} font-mono uppercase`} value={yardCode} onChange={e => { ++aiRequest.current; setYardCode(e.target.value.toUpperCase()); setAiRecommendation(null); setBackendPayload(null); setForm(prev => ({ ...prev, containerGrossWeightTon: null, cargoType: '', sealNumber: '' })) }} placeholder="TC-XXXX-XXXX-XXXX" /><button type="button" onClick={paste} className="rounded-xl border border-chalk bg-white px-5 font-bold">Dán</button></div><p className="font-normal">Dán mã nhận được khi đặt Dropoff hoặc mã công ty khác gửi. Bấm Phân tích lại để gợi ý xe và tài xế cho lượt này.</p></label>}
                  {/* Container Spec Details Card */}
                  {form.containerNo ? (
                    <div className="bg-white border border-chalk rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shadow-xs animate-in fade-in">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Mã Số Container:</span>
                        <div className="font-mono font-extrabold text-carbon text-sm flex items-center gap-1.5">
                          <span>{form.containerNo}</span>
                          <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Kích Thước & Loại:</span>
                        <p className="font-bold text-carbon">{selected?.containerTypeCode} · {form.bookingType === 'Dropoff' || aiRecommendation ? form.cargoType || 'Chưa xác định' : '—'}</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Khối Lượng Toàn Bộ:</span>
                        <p className="font-mono font-extrabold text-signal-orange text-sm">
                          {form.bookingType === 'Pickup' && !aiRecommendation ? '—' : form.containerGrossWeightTon == null ? 'Chưa có khối lượng' : `${form.containerGrossWeightTon} Tấn`}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Số Niêm Chì (Seal No):</span>
                        <p className="font-mono font-bold text-slate-700">{form.bookingType === 'Dropoff' || aiRecommendation ? form.sealNumber || 'Chưa cung cấp' : '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 flex items-start sm:items-center gap-3 text-xs text-indigo-950">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700">
                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      </div>
                      <div className="flex-1">
                        <strong className="font-bold text-indigo-900 block text-xs sm:text-sm">
                          Hệ thống đang chờ chọn Container
                        </strong>
                        <p className="text-indigo-800 text-[11px] mt-0.5">
                          Vui lòng chọn một container ở trên. Hệ thống sẽ tự động tính toán tải trọng và điền Xe đầu kéo cùng Tài xế thích hợp nhất từ kho tài nguyên.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. AI RECOMMENDED VEHICLE & DRIVER */}
                <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-chalk pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center gap-1.5 border border-indigo-200">
                        <span className="material-symbols-outlined text-sm">tune</span>
                        Tối Ưu Tự Động
                      </span>
                      <span className="text-xs font-bold text-carbon">
                        3. Điều Phối Xe Đầu Kéo & Tài Xế Phù Hợp
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={aiMatching || !form.selectedContainerId}
                      onClick={() => triggerBackendAiRecommendation(form.selectedContainerId)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer w-fit"
                    >
                      <span className={`material-symbols-outlined text-sm ${aiMatching ? 'animate-spin' : ''}`}>
                        {aiMatching ? 'sync' : 'auto_awesome'}
                      </span>
                      {aiMatching ? 'Đang phân tích...' : 'Phân tích lại'}
                    </button>
                  </div>

                  {/* AI Match Success Banner */}
                  {aiRecommendation && form.selectedContainerId && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-3 text-xs text-emerald-950 animate-in fade-in">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                        <span className="material-symbols-outlined text-lg">verified</span>
                      </div>
                      <div className="flex-1 text-[11px] leading-relaxed">
                        <strong className="text-emerald-900 font-bold block text-xs">Đề Xuất Cặp Đôi Tối Ưu:</strong>
                        Đã chọn xe <strong>{aiRecommendation.recommendedTruckPlate}</strong> (Tải tối đa {aiRecommendation.truckMaxPayloadTon}T) và Tài xế <strong>{aiRecommendation.recommendedDriverName}</strong> cho Container {form.containerNo} ({form.containerGrossWeightTon}T).
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Truck Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
                        <span>Xe Đầu Kéo (Truck)</span>
                        <span className="text-[10px] text-indigo-600 font-bold">✨ Đề xuất tự động</span>
                      </label>
                      <select
                        value={form.truckId}
                        onChange={(e) => handleTruckChange(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange cursor-pointer"
                      >
                        <option value="">
                          {form.selectedContainerId ? '-- Chọn xe đầu kéo khác --' : '-- Chọn container trước --'}
                        </option>
                        {(availableResources.trucks || []).map((t) => (
                          <option key={t.id} value={t.id}>
                            🚚 Biển số: {t.plateNumber} · Tải trọng: {t.maxPayloadTon} Tấn ({t.vehicleType})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Driver Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
                        <span>Tài Xế Phụ Trách (Driver)</span>
                        <span className="text-[10px] text-indigo-600 font-bold">✨ Ghép nối tự động</span>
                      </label>
                      <select
                        value={form.driverId}
                        onChange={(e) => {
                          const driverId = e.target.value;
                          let truckId = form.truckId;
                          if (driverId) {
                            const assignedTruck = (availableResources.trucks || []).find(t => String(t.driverId) === String(driverId));
                            if (assignedTruck) truckId = assignedTruck.id;
                          }
                          setForm({ ...form, driverId, truckId });
                        }}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange cursor-pointer"
                      >
                        <option value="">
                          {form.selectedContainerId ? '-- Chọn tài xế khác --' : '-- Chọn container trước --'}
                        </option>
                        {(availableResources.drivers || []).map((d) => (
                          <option key={d.id} value={d.id}>
                            👤 {d.fullName} (Hạng: {d.licenseClass || 'FC'}) · {d.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 4. DYNAMIC INTERACTIVE PAYLOAD GAUGE */}
                  {form.selectedContainerId && !backendPayload && <div role="status" className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-900"><span className={`material-symbols-outlined ${aiMatching ? 'animate-spin' : ''}`}>{aiMatching ? 'sync' : 'analytics'}</span><div><strong className="block">Phân tích tải trọng & gợi ý phối xe</strong><p className="mt-1 leading-relaxed">{aiMatching ? 'Đang phân tích dữ liệu giao nhận và xe/tài xế của công ty…' : form.bookingType === 'Pickup' && !yardCode.trim() ? 'Nhập mã lượt bãi để phân tích đúng hàng hóa của lượt cần lấy.' : form.bookingType === 'Dropoff' && selected?.grossWeightKg == null ? 'Bản khai chưa có khối lượng thực tế. Bạn có thể chọn xe/tài xế thủ công hoặc quay lại khai báo để bổ sung khối lượng.' : 'Chưa có kết quả phân tích. Bấm Phân tích lại; nếu có lỗi, thông báo chi tiết được hiển thị phía trên.'}</p></div></div>}
                  {form.selectedContainerId && backendPayload && (
                    <div className="p-4 rounded-2xl bg-fog/70 border border-chalk space-y-3 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-carbon">Đánh giá Độ An Toàn Tải Trọng:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            backendPayload.severity === 'danger'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : backendPayload.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {backendPayload.status === 'Overloaded' ? '⚠️ Quá tải nghiêm trọng' : backendPayload.status === 'Underutilized' ? '⚠️ Tải trọng chưa tối ưu' : '✅ Đạt chuẩn an toàn'}
                          </span>
                        </div>

                        <span className="font-mono font-bold text-carbon">
                          Hàng: {form.containerGrossWeightTon}T / Xe: {selectedTruck ? selectedTruck.maxPayloadTon : '—'}T ({backendPayload.ratio}%)
                        </span>
                      </div>

                      {/* Visual Meter Bar */}
                      <div className="w-full h-3 bg-chalk rounded-full overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${Math.min(backendPayload.ratio, 100)}%` }}
                          className={`h-full transition-all duration-500 rounded-full ${
                            backendPayload.severity === 'danger'
                              ? 'bg-rose-600'
                              : backendPayload.severity === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        ></div>
                      </div>

                      {/* Guidance Box */}
                      <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                        backendPayload.severity === 'danger'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : backendPayload.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <span className={`material-symbols-outlined text-base ${
                          backendPayload.severity === 'danger' ? 'text-rose-600' : backendPayload.severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {backendPayload.severity === 'danger' ? 'error' : backendPayload.severity === 'warning' ? 'warning' : 'verified'}
                        </span>
                        <span className="text-[11px] font-medium leading-relaxed">
                          {backendPayload.warningMessage}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Continue Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.selectedContainerId && !form.containerNo) {
                        showNotification('Vui lòng chọn container trước khi tiếp tục!', 'error')
                        return
                      }
                      setWizardStep(2)
                    }}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Tiếp tục: Khung giờ & Xác nhận (Bước 2)</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: TIME SLOT & BOARDING PASS CONFIRMATION */}
            {wizardStep === 2 && selected && (
              <div className="space-y-6">
                {/* Date Time Picker Grid */}
                <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-carbon">
                    Xác Nhận Khung Thời Gian Hẹn Đến Cảng
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500">Ngày Hẹn Đến Cảng</label>
                      <input
                        type="date"
                        required
                        value={form.appointmentDate}
                        onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500">Giờ Bắt Đầu (Start Time)</label>
                      <input
                        type="time"
                        required
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500">Giờ Kết Thúc (End Time)</label>
                      <input
                        type="time"
                        required
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-2 pt-1 overflow-x-auto text-[11px]">
                    <span className="text-slate-400 font-medium">Ca gợi ý:</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startTime: '08:30', endTime: '10:30' })}
                      className="px-2.5 py-1 rounded-lg bg-fog hover:bg-chalk text-slate-700 font-semibold border border-chalk transition-colors cursor-pointer"
                    >
                      ☀️ Ca Sáng (08:30 - 10:30)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startTime: '14:00', endTime: '16:00' })}
                      className="px-2.5 py-1 rounded-lg bg-fog hover:bg-chalk text-slate-700 font-semibold border border-chalk transition-colors cursor-pointer"
                    >
                      ⛅ Ca Chiều (14:00 - 16:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startTime: '20:00', endTime: '22:00' })}
                      className="px-2.5 py-1 rounded-lg bg-fog hover:bg-chalk text-slate-700 font-semibold border border-chalk transition-colors cursor-pointer"
                    >
                      🌙 Ca Đêm (20:00 - 22:00)
                    </button>
                  </div>
                </div>

                {/* DIGITAL E-PASS BOARDING PASS TICKET PREVIEW */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50/40 via-white to-slate-50 text-carbon p-6 sm:p-7 border-2 border-orange-200/80 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-200/60 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-signal-orange flex items-center justify-center font-black text-white text-sm shadow-sm shadow-orange-500/20">
                        NP
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-signal-orange">NexusPort Smart TAS</span>
                        <h5 className="font-mono font-bold text-sm text-carbon">Thẻ Điện Tử Dự Kiến · Digital e-Pass</h5>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                      CHỜ PHÊ DUYỆT [PENDING]
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-500 font-semibold text-[11px]">MÃ BOOKING:</span>
                      <p className="font-mono font-black text-base text-signal-orange tracking-tight">{form.bookingCode}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-semibold text-[11px]">LOẠI GIAO DỊCH:</span>
                      <p className="font-bold text-carbon text-sm">{form.bookingType}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-semibold text-[11px]">CONTAINER:</span>
                      <p className="font-mono font-bold text-carbon text-sm">{form.containerNo} ({form.containerGrossWeightTon}T)</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-semibold text-[11px]">PHƯƠNG TIỆN & TÀI XẾ:</span>
                      <p className="font-mono font-bold text-carbon text-sm">
                        {selectedTruck?.plateNumber || 'Chưa phân công'} • {availableResources.drivers.find(d => d.id === form.driverId)?.fullName || 'Tài xế'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-orange-200/60 flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                    <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                    Sau khi đặt lịch, booking chờ điều độ phê duyệt trước khi thực hiện giao nhận.
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-6 py-3.5 rounded-2xl border border-chalk bg-white hover:bg-fog text-carbon font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Quay lại Bước 1 (Đổi xe / tài xế)</span>
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white font-extrabold text-xs shadow-lg shadow-orange-950/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                    <span>Xác Nhận & Khởi Tạo Booking</span>
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                  </button>
                </div>

              </div>
            )}

          </form>
        </div>
  )
}
