import React, { useEffect, useMemo, useState } from 'react'
import { containerService } from '../../services/containerService'

const initialForm = {
  containerNumber: '', containerTypeCode: '', sourceReference: '', sealNumber: '',
  loadStatus: 'unknown', cargoType: 'general', grossWeightKg: '',
  expectedArrivalAt: '', requestedPickupDate: '',
  blBookingNumber: '', customerName: '', transportCompanyName: '', movementType: 'pickup_request',
}

const resultLabel = {
  created_master: 'Đã tạo Container Master và lượt cảng',
  created_visit: 'Đã tạo lượt cảng cho Container có sẵn',
  updated_visit: 'Đã cập nhật lượt cảng trùng tham chiếu',
  duplicate: 'Dữ liệu đã tồn tại, không tạo thêm',
}

const localDateTimeToIso = (value) => value ? new Date(value).toISOString() : null

export default function ContainerIntake({ embedded = false, onBack }) {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) }
    catch { return null }
  }, [])
  const isTransport = ['Transport Company', 'Carrier Staff', 'Carrier'].includes(user?.role)
  const templateFileName = isTransport
    ? 'NXP-038_Container_Import_Cong_Ty_Van_Chuyen.xlsx'
    : 'NXP-038_Container_Import_Cang_Tau.xlsx'
  const [mode, setMode] = useState('manual')
  const [types, setTypes] = useState([])
  const [form, setForm] = useState({ ...initialForm, transportCompanyName: isTransport ? (user?.companyName || user?.fullName || '') : '' })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    containerService.getContainerTypes().then((data) => {
      setTypes(data || [])
      setForm((current) => ({ ...current, containerTypeCode: current.containerTypeCode || data?.[0]?.code || '' }))
    }).catch((error) => setMessage({ type: 'error', text: error.message }))
    if (!isTransport) containerService.getContainerImports().then(setHistory).catch(() => {})
  }, [isTransport])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submitManual = async (event) => {
    event.preventDefault(); setLoading(true); setMessage(null); setImportResult(null)
    const payload = {
      ...form,
      containerNumber: form.containerNumber.toUpperCase().replace(/[\s-]+/g, ''),
      grossWeightKg: form.grossWeightKg === '' ? null : Number(form.grossWeightKg),
      expectedArrivalAt: localDateTimeToIso(form.expectedArrivalAt),
      movementType: isTransport ? form.movementType : 'vessel_discharge',
    }
    try {
      const result = isTransport
        ? await containerService.createTransportIntake(payload)
        : await containerService.createPortIntake(payload)
      setMessage({ type: 'success', text: resultLabel[result.status] || 'Đã lưu thông tin Container.' })
      setForm((current) => ({ ...initialForm, containerTypeCode: current.containerTypeCode, transportCompanyName: current.transportCompanyName, movementType: current.movementType }))
    } catch (error) {
      const detail = error.details && Object.values(error.details).flat()[0]
      setMessage({ type: 'error', text: detail || error.message })
    } finally { setLoading(false) }
  }

  const submitImport = async () => {
    if (!file) return setMessage({ type: 'error', text: 'Vui lòng chọn file Excel.' })
    setLoading(true); setMessage(null); setImportResult(null)
    try {
      const result = isTransport
        ? await containerService.importTransportContainers(file)
        : await containerService.importPortContainers(file)
      setImportResult(result)
      setMessage({ type: result.failedRows ? 'warning' : 'success', text: `Đã xử lý ${result.totalRows} dòng: ${result.successRows} thành công, ${result.duplicateRows} trùng, ${result.failedRows} lỗi.` })
      if (!isTransport) containerService.getContainerImports().then(setHistory).catch(() => {})
    } catch (error) { setMessage({ type: 'error', text: error.message }) }
    finally { setLoading(false) }
  }

  const inputClass = 'w-full rounded-lg border border-chalk bg-white px-3 py-2.5 text-sm outline-none focus:border-signal-orange'
  const estimatedAvailableAt = form.expectedArrivalAt
    ? new Date(new Date(form.expectedArrivalAt).getTime() + 12 * 60 * 60 * 1000).toLocaleString('vi-VN')
    : 'Tự động tính sau khi nhập ETA'
  const field = (label, key, props = {}) => (
    <label className="space-y-1.5 text-sm font-semibold text-graphite">
      <span>{label}{props.required && <b className="text-red-600"> *</b>}</span>
      <input className={inputClass} value={form[key]} onChange={(e) => update(key, e.target.value)} {...props} />
    </label>
  )

  return (
    <div className={embedded ? 'w-full' : 'min-h-screen bg-fog p-5 lg:p-8'}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {onBack && <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-slate hover:text-carbon"><span className="material-symbols-outlined text-lg">arrow_back</span>Quay lại danh sách Container</button>}
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-signal-orange">NXP-038 · Container Intake</p>
            <h1 className="mt-1 font-heading text-3xl font-black text-carbon">{isTransport ? 'Khai báo Container vận chuyển' : 'Tiếp nhận danh sách Container cảng/tàu'}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate">{isTransport ? 'Khai báo Container dự kiến giao hoặc nhận. Dữ liệu được giữ ở trạng thái chờ đối soát với nguồn cảng.' : 'Tạo Container Master và lượt cảng dự kiến từ nhập tay hoặc file Excel. Chưa phát hành EIR.'}</p>
          </div>
          <a href={`/templates/${templateFileName}`} download={templateFileName} className="rounded-lg border border-carbon bg-white px-4 py-2.5 text-sm font-bold text-carbon hover:bg-chalk">
            {isTransport ? 'Tải mẫu Công ty vận chuyển' : 'Tải mẫu Cảng/Tàu'}
          </a>
        </header>

        <div className="flex gap-2 rounded-xl border border-chalk bg-white p-2">
          {[['manual', 'Nhập thủ công'], ['import', 'Import Excel']].map(([value, label]) => (
            <button key={value} onClick={() => { setMode(value); setMessage(null) }} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === value ? 'bg-carbon text-white' : 'text-slate hover:bg-fog'}`}>{label}</button>
          ))}
        </div>

        {message && <div className={`rounded-xl border p-4 text-sm font-semibold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : message.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}

        {mode === 'manual' ? (
          <form onSubmit={submitManual} className="rounded-2xl border border-chalk bg-white p-5 shadow-sm lg:p-7">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {field('Số Container', 'containerNumber', { required: true, placeholder: 'EMCU8361795' })}
              <label className="space-y-1.5 text-sm font-semibold text-graphite"><span>ISO / Loại Container <b className="text-red-600">*</b></span><select className={inputClass} value={form.containerTypeCode} onChange={(e) => update('containerTypeCode', e.target.value)} required>{types.map((type) => <option key={type.id} value={type.code}>{type.code} · {type.size} · {type.category}</option>)}</select></label>
              {field('Mã tham chiếu nguồn', 'sourceReference', { placeholder: isTransport ? 'Số lệnh/phiếu của công ty' : 'Manifest/Discharge list' })}
              {field('Seal', 'sealNumber', { placeholder: 'EMCXCR3074' })}
              <label className="space-y-1.5 text-sm font-semibold text-graphite"><span>Tình trạng hàng</span><select className={inputClass} value={form.loadStatus} onChange={(e) => update('loadStatus', e.target.value)}><option value="unknown">Chưa xác định</option><option value="full">Đầy hàng</option><option value="empty">Rỗng</option></select></label>
              <label className="space-y-1.5 text-sm font-semibold text-graphite"><span>Loại hàng</span><select className={inputClass} value={form.cargoType} onChange={(e) => update('cargoType', e.target.value)}>{['general','reefer','dangerous','perishable','oversized','overweight'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              {field('Khối lượng (kg)', 'grossWeightKg', { type: 'number', min: 0 })}
              {field('Số B/L hoặc Booking ngoài', 'blBookingNumber')}
              {field('Tên khách hàng/chủ hàng', 'customerName')}
              {isTransport ? <>
                {field('Tên công ty vận chuyển', 'transportCompanyName', { required: true })}
                <label className="space-y-1.5 text-sm font-semibold text-graphite"><span>Nhu cầu <b className="text-red-600">*</b></span><select className={inputClass} value={form.movementType} onChange={(e) => update('movementType', e.target.value)}><option value="pickup_request">Đến nhận Container</option><option value="truck_dropoff">Đưa Container vào cảng</option></select></label>
                {form.movementType === 'pickup_request' && field('Ngày mong muốn nhận', 'requestedPickupDate', { type: 'date', required: true })}
              </> : <>
                {field('Thời gian dự kiến cập cảng', 'expectedArrivalAt', { type: 'datetime-local', required: true })}
                <div className="space-y-1.5 text-sm font-semibold text-graphite">
                  <span>Thời gian dự kiến hoàn tất bốc dỡ</span>
                  <div className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-slate">{estimatedAvailableAt}</div>
                  <p className="text-xs font-normal text-slate">Tạm tính bằng thời gian cập cảng + 12 giờ.</p>
                </div>
              </>}
            </div>
            <div className="mt-6 flex justify-end"><button disabled={loading || !types.length} className="rounded-lg bg-signal-orange px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{loading ? 'Đang lưu...' : 'Lưu Container và lượt cảng'}</button></div>
          </form>
        ) : (
          <section className="space-y-5 rounded-2xl border border-chalk bg-white p-5 shadow-sm lg:p-7">
            <div className="rounded-xl border-2 border-dashed border-chalk bg-fog p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-slate">upload_file</span>
              <p className="mt-2 font-bold text-carbon">Chọn file Excel .xlsx hoặc .xls, tối đa 5 MB và 1.000 dòng</p>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mx-auto mt-4 block max-w-full text-sm" />
              <button onClick={submitImport} disabled={loading || !file} className="mt-5 rounded-lg bg-carbon px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{loading ? 'Đang xử lý...' : 'Import và kiểm tra trùng'}</button>
            </div>
            {importResult?.rows?.some((row) => row.errors?.length) && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-fog"><th className="p-3">Dòng</th><th className="p-3">Container</th><th className="p-3">Kết quả</th></tr></thead><tbody>{importResult.rows.filter((row) => row.errors?.length).map((row) => <tr key={row.rowNumber} className="border-b"><td className="p-3">{row.rowNumber}</td><td className="p-3 font-mono">{row.containerNumber || '—'}</td><td className="p-3 text-red-700">{row.errors.join('; ')}</td></tr>)}</tbody></table></div>}
          </section>
        )}

        {!isTransport && history.length > 0 && <section className="rounded-2xl border border-chalk bg-white p-5"><h2 className="font-heading text-lg font-black text-carbon">Lịch sử import gần đây</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b bg-fog"><th className="p-3">File</th><th className="p-3">Nguồn</th><th className="p-3">Tổng</th><th className="p-3">Thành công</th><th className="p-3">Trùng</th><th className="p-3">Lỗi</th><th className="p-3">Thời gian</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b"><td className="p-3 font-semibold">{item.fileName}</td><td className="p-3">{item.sourceType === 'port_vessel' ? 'Cảng/tàu' : 'Công ty vận chuyển'}</td><td className="p-3">{item.totalRows}</td><td className="p-3 text-emerald-700">{item.successRows}</td><td className="p-3 text-amber-700">{item.duplicateRows}</td><td className="p-3 text-red-700">{item.failedRows}</td><td className="p-3 text-slate">{new Date(item.createdAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div></section>}
      </div>
    </div>
  )
}
