import { useEffect, useRef, useState } from 'react'
import { shippingLineApi, formatApiErrorMessage } from '../api/shippingLineApi'

const buttonClass = 'rounded-lg border border-chalk px-4 py-2 text-sm font-semibold hover:bg-fog disabled:opacity-50'

export default function ManifestImportDialog({ onClose, onReview }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const dialog = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.querySelector('button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  const selectFile = event => {
    setResult(null); setError('')
    const next = event.target.files?.[0] || null
    if (next && (!/\.xlsx$/i.test(next.name) || next.size > 5 * 1024 * 1024)) {
      setFile(null); event.target.value = ''; setError('Chọn file .xlsx không vượt quá 5 MB.'); return
    }
    setFile(next)
  }
  const preview = async event => {
    event.preventDefault()
    if (!file || busy) return
    setBusy(true); setError(''); setResult(null)
    try { setResult(await shippingLineApi.previewManifestImport(file)) }
    catch (e) { setError(formatApiErrorMessage(e, 'Không thể kiểm tra file Excel. Vui lòng thử lại.')) }
    finally { setBusy(false) }
  }
  const download = async () => {
    setDownloading(true); setError('')
    try {
      const blob = await shippingLineApi.getManifestImportTemplate()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'Manifest_mau.xlsx'
      document.body.append(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(formatApiErrorMessage(e, 'Không thể tải file mẫu.')) }
    finally { setDownloading(false) }
  }
  const onKeyDown = event => {
    if (event.key === 'Escape' && !busy && !downloading) { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') return
    const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')]
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-6">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="manifest-import-title" onKeyDown={onKeyDown} className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
      <header className="flex items-start justify-between gap-4 border-b border-chalk p-5">
        <div><h2 id="manifest-import-title" className="text-xl font-bold">Import bản khai từ Excel</h2><p className="mt-1 text-sm text-slate">Một file, một sheet, một bản khai. Mỗi dòng là một container.</p></div>
        <button type="button" disabled={busy || downloading} onClick={onClose} className={buttonClass} aria-label="Đóng import">✕</button>
      </header>
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-chalk bg-fog p-4 text-sm">
          <p>Lặp lại thông tin chuyến tàu và vận đơn trên mỗi dòng. Giữ đủ 10 cột theo mẫu, không gộp ô và nhập trọng lượng bằng ô dạng số.</p>
          <p className="mt-2 text-slate">Tối đa 5.000 container/file, 500 container/vận đơn và 100 vận đơn. ISO và dấu hiệu cont lạnh tự lấy từ container đã đăng ký.</p>
          <button type="button" disabled={downloading || busy} className={`${buttonClass} mt-3 bg-white text-signal-orange`} onClick={download}>{downloading ? 'Đang tải…' : 'Tải file mẫu trống'}</button>
        </div>
        <form onSubmit={preview} className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-semibold">File Excel (.xlsx, tối đa 5 MB)<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={selectFile} className="mt-2 block w-full rounded-lg border border-chalk bg-white p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-orange-700" /></label>
          <button type="submit" disabled={!file || busy || downloading} className="rounded-lg bg-signal-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang kiểm tra…' : 'Kiểm tra file'}</button>
        </form>
        {error && <p role="alert" className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {result && !result.valid && <div role="alert" className="space-y-3">
          <p className="text-sm font-semibold text-red-700">Có {result.totalErrors} lỗi. Sửa file rồi chọn lại để kiểm tra. Chưa có dữ liệu nào được lưu.</p>
          {result.totalErrors > result.errors.length && <p className="text-xs text-slate">Hiển thị {result.errors.length} lỗi đầu tiên.</p>}
          <div className="max-h-72 overflow-auto rounded-lg border border-chalk" tabIndex={0} aria-label="Lỗi trong file Excel"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-fog"><tr><th className="p-3">Dòng Excel</th><th className="p-3">Cột</th><th className="p-3">Nội dung lỗi</th></tr></thead><tbody>{result.errors.map((item, i) => <tr key={i} className="border-t border-chalk"><td className="p-3 align-top">{item.row}</td><td className="whitespace-nowrap p-3 align-top">{item.column}</td><td className="p-3">{item.message}</td></tr>)}</tbody></table></div>
        </div>}
        {result?.valid && <div role="status" className="space-y-2 rounded-xl border border-chalk p-4 text-sm">
          <p className="font-bold">File hợp lệ: {result.totalBills} vận đơn · {result.totalRows} container · {Number(result.totalWeightKg).toLocaleString('vi-VN')} kg</p>
          <p>{result.manifest.voyageNumber} · {result.manifest.vesselName} · {result.manifest.direction === 'EXPORT' ? 'Xuất khẩu' : 'Nhập khẩu'}</p>
          <p className="text-slate">Chọn “Xem lại bản khai” để kiểm tra hoặc chỉnh sửa. Bản khai chỉ được lưu khi bạn chọn Lưu nháp hoặc Hoàn tất.</p>
        </div>}
      </div>
      <footer className="flex justify-end gap-3 border-t border-chalk p-5">
        <button type="button" disabled={busy || downloading} onClick={onClose} className={buttonClass}>Đóng</button>
        {result?.valid && <button type="button" disabled={busy || downloading} onClick={() => onReview(result.manifest)} className="rounded-lg bg-signal-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Xem lại bản khai</button>}
      </footer>
    </section>
  </div>
}
