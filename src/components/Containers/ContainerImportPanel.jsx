import React, { useRef, useState } from 'react'

const formatFileSize = bytes => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`

export default function ContainerImportPanel({ file, onFileChange, onImport, onDownload, onError, submitting, result }) {
  const fileInput = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const selectFile = nextFile => {
    if (submitting || !nextFile) return
    if (!/\.(xlsx|xls)$/i.test(nextFile.name)) {
      onFileChange(null)
      onError('Vui lòng chọn file Excel định dạng .xlsx hoặc .xls.')
    } else if (nextFile.size > 5 * 1024 * 1024) {
      onFileChange(null)
      onError('File vượt quá 5 MB. Vui lòng chọn file nhỏ hơn.')
    } else {
      onError('')
      onFileChange(nextFile)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const download = async () => {
    setDownloading(true)
    onError('')
    try { await onDownload() }
    catch (error) { onError(error.message) }
    finally { setDownloading(false) }
  }

  return <div className="space-y-5 p-6">
    <div className="flex flex-col gap-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl text-signal-orange">table_view</span>
        <div>
          <p className="text-sm font-bold text-carbon">Mẫu khai báo Container</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Một sheet Container, đủ 8 trường như form thủ công.</p>
        </div>
      </div>
      <button type="button" onClick={download} disabled={downloading || submitting} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-2.5 text-xs font-bold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
        <span aria-hidden="true" className={`material-symbols-outlined text-lg ${downloading ? 'animate-spin' : ''}`}>{downloading ? 'progress_activity' : 'download'}</span>
        {downloading ? 'Đang tải...' : 'Tải file mẫu'}
      </button>
    </div>

    <div
      onDragOver={event => { event.preventDefault(); if (!submitting) setDragging(true) }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
      onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]) }}
      className={`rounded-2xl border-2 border-dashed px-5 py-7 text-center transition ${dragging ? 'border-signal-orange bg-orange-50' : 'border-slate-200 bg-slate-50/70'}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl text-slate-500 shadow-sm">upload_file</span>
      <p className="mt-4 text-sm font-bold text-carbon">Kéo và thả file Excel vào đây</p>
      <p id="container-file-help" className="mt-1.5 text-xs text-slate-500">Định dạng .xlsx, .xls · Tối đa 5 MB · 1.000 container</p>
      <input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="File khai báo Container" aria-describedby="container-file-help" tabIndex={-1} className="sr-only" disabled={submitting} onChange={event => selectFile(event.target.files?.[0])} />
      <button type="button" onClick={() => fileInput.current?.click()} disabled={submitting} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-carbon shadow-sm transition hover:border-signal-orange hover:text-signal-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
        <span aria-hidden="true" className="material-symbols-outlined text-lg">folder_open</span>
        {file ? 'Chọn file khác' : 'Chọn tệp Excel'}
      </button>
      {file && <div role="status" className="mx-auto mt-5 flex max-w-md items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-left">
        <span aria-hidden="true" className="material-symbols-outlined text-2xl text-emerald-600">description</span>
        <div className="min-w-0 flex-1"><p title={file.name} className="truncate text-xs font-bold text-carbon">{file.name}</p><p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)} · Sẵn sàng import</p></div>
        <button type="button" aria-label="Bỏ file đã chọn" onClick={() => onFileChange(null)} disabled={submitting} className="material-symbols-outlined rounded-lg p-1.5 text-lg text-slate-400 hover:bg-slate-100 hover:text-carbon disabled:opacity-50">close</button>
      </div>}
    </div>

    <p className="flex gap-2 text-xs leading-5 text-slate-500"><span aria-hidden="true" className="material-symbols-outlined mt-0.5 shrink-0 text-base">info</span><span>Mỗi dòng là một Container. Công ty thực hiện vận chuyển được chọn khi booking. Số seal không bắt buộc. Hàng đông lạnh cần nhập công suất điện (kW); các loại hàng khác để trống cột này.</span></p>

    {result && <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-bold text-carbon">Kết quả import</p>
      <p className="mt-2 text-xs text-slate-600">{result.successRows} thành công · {result.duplicateRows} trùng · {result.failedRows} lỗi</p>
      {result.rows.filter(row => row.errors.length).map(row => <p key={row.rowNumber} className="mt-2 text-xs leading-5 text-red-700">Dòng {row.rowNumber}: {row.errors.join('; ')}</p>)}
    </div>}

    <div className="flex justify-end border-t border-chalk pt-5">
      <button type="button" onClick={onImport} disabled={submitting || !file} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-signal-orange px-6 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none sm:w-auto">
        <span aria-hidden="true" className={`material-symbols-outlined text-lg ${submitting ? 'animate-spin' : ''}`}>{submitting ? 'progress_activity' : 'upload'}</span>
        {submitting ? 'Đang xử lý...' : 'Import và lưu'}
      </button>
    </div>
  </div>
}
