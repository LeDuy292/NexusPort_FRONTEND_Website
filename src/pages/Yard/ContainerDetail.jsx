import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import Select from '../../components/ui/Select'

// ─── Cấu hình hiển thị ───────────────────────────────────────────────────────
const STATUS_CFG = {
  IN_YARD: { label: 'Trong bãi', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  RESERVED: { label: 'Đã giữ chỗ', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
}

const fmtWeight = (kg) => (kg == null ? '—' : `${Number(kg).toLocaleString('vi-VN')} kg`)
const fmtDateTime = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
const val = (v) => (v == null || v === '' ? '—' : v)
const CARGO_LABELS = { general: 'Hàng khô thông thường', dry: 'Hàng khô thông thường', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', oversized: 'Hàng quá khổ', perishable: 'Hàng dễ hỏng' }
const cargoLabel = (v) => (v ? (CARGO_LABELS[String(v).toLowerCase()] || v) : null)

function StatusBadge({ status }) {
  const st = STATUS_CFG[status] || STATUS_CFG.IN_YARD
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${st.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums break-words">{children}</div>
    </div>
  )
}

function Card({ icon, title, right, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-500 text-lg">{icon}</span>
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  )
}

// ─── Ảnh container (lưu trên S3, link có hạn) ─────────────────────────────────
function PhotoGallery({ photos }) {
  const [open, setOpen] = useState(null)
  const [broken, setBroken] = useState({})

  useEffect(() => {
    if (open == null) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % photos.length)
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, photos.length])

  if (!photos.length) {
    return <p className="text-sm text-slate-500 py-1">Chưa có ảnh nào được lưu cho container này.</p>
  }
  const current = open != null ? photos[open] : null
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {photos.map((ph, i) => (
          <button key={ph.url} type="button" onClick={() => setOpen(i)} className="group text-left rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-orange-300 transition-colors cursor-pointer">
            <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
              {broken[ph.url] ? (
                <span className="material-symbols-outlined text-slate-300 text-3xl">broken_image</span>
              ) : (
                <img src={ph.url} alt={`Ảnh container ${i + 1}`} loading="lazy" onError={() => setBroken((b) => ({ ...b, [ph.url]: true }))} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              )}
            </div>
            <div className="px-2.5 py-2">
              <div className="text-xs font-semibold text-slate-700 truncate">{ph.label}</div>
              <div className="text-[11px] text-slate-400 tabular-nums">{fmtDateTime(ph.at)}</div>
            </div>
          </button>
        ))}
      </div>

      {current && (
        <div className="fixed inset-0 z-[90] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={current.url} alt={current.label} className="w-full max-h-[80vh] object-contain rounded-xl bg-black/30" />
            <div className="mt-3 flex items-center justify-between text-slate-100 text-sm">
              <span>{current.label} · <span className="tabular-nums text-slate-300">{fmtDateTime(current.at)}</span></span>
              <span className="tabular-nums text-slate-300">{open + 1} / {photos.length}</span>
            </div>
            <button type="button" onClick={() => setOpen(null)} aria-label="Đóng" className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 shadow flex items-center justify-center cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => setOpen((i) => (i - 1 + photos.length) % photos.length)} aria-label="Ảnh trước" className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-700 shadow flex items-center justify-center cursor-pointer">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button type="button" onClick={() => setOpen((i) => (i + 1) % photos.length)} aria-label="Ảnh sau" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-700 shadow flex items-center justify-center cursor-pointer">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Chi tiết một container ──────────────────────────────────────────────────
function DetailView({ container: c, onBack }) {
  const photos = c.photos || []
  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-orange-600 transition-colors w-fit cursor-pointer">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Quay lại danh sách
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">{c.containerNo}</h2>
            <StatusBadge status={c.status} />
            {c.isReefer && (
              <span className="px-2 py-0.5 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 text-[11px] font-semibold">Container lạnh</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {[c.type, c.line].filter(Boolean).join(' · ') || 'Chưa có thông tin loại / hãng tàu'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/yard-staff/map" className="px-4 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">map</span>
            Xem trên sơ đồ bãi
          </Link>
          <Link to="/yard-staff/gate-out-preparation" className="px-4 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors">
            <span className="material-symbols-outlined text-base">local_shipping</span>
            Chuẩn bị xuất cổng
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card icon="inventory_2" title="Thông tin container">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Loại container">{val(c.type)}</Field>
              <Field label="Trọng lượng">{fmtWeight(c.weightKg)}</Field>
              <Field label="Số niêm phong">{val(c.sealNo)}</Field>
              <Field label="Hãng tàu">{val(c.line)}</Field>
              <Field label="Tàu / chuyến">{c.vessel ? `${c.vessel}${c.voyage ? ` · ${c.voyage}` : ''}` : '—'}</Field>
              <Field label="Loại hàng">{val(cargoLabel(c.cargo))}</Field>
            </div>
          </Card>

          <Card icon="local_shipping" title="Xe và tác nghiệp">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Tác nghiệp">{val(c.operationType)}</Field>
              <Field label="Mã booking / lệnh">{val(c.bookingCode)}</Field>
              <Field label="Công ty">{val(c.company)}</Field>
              <Field label="Biển số xe">{val(c.vehiclePlate)}</Field>
              <Field label="Tài xế">{val(c.driverName)}</Field>
              <Field label="Thiết bị / vận hành">{c.equipmentCode ? `${c.equipmentCode}${c.operatorName ? ` · ${c.operatorName}` : ''}` : '—'}</Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card icon="location_on" title="Vị trí ô bãi">
            <div className="rounded-xl border border-orange-200 bg-orange-50 py-3 text-center">
              <div className="text-[11px] font-semibold text-orange-700">Vị trí hiện tại</div>
              <div className="text-xl font-extrabold text-orange-900 tabular-nums mt-0.5">{c.position}</div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3 text-center">
              {[['Khu', c.block], ['Bay', c.bay], ['Hàng', c.row], ['Tầng', c.tier]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-200 bg-slate-50 py-2">
                  <div className="text-[10px] text-slate-500">{k}</div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card icon="verified" title="Kiểm tra vỏ container">
            <div className="space-y-2.5">
              <Field label="Tình trạng">{val(c.condition)}</Field>
              <Field label="Lần kiểm tra gần nhất">{fmtDateTime(c.lastInspectionAt)}</Field>
              <Field label="Người kiểm tra">{val(c.inspectionBy)}</Field>
            </div>
          </Card>
        </div>
      </div>

      <Card icon="photo_library" title="Ảnh container" right={<span className="text-xs text-slate-500 tabular-nums">{photos.length} ảnh</span>}>
        <PhotoGallery photos={photos} />
      </Card>

      <Card icon="history" title="Lịch sử dịch chuyển" right={<span className="text-xs text-slate-500 tabular-nums">{c.history.length} sự kiện</span>}>
        {c.history.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">Chưa có sự kiện nào được ghi nhận cho container này.</p>
        ) : (
          <ol className="space-y-2.5">
            {c.history.map((h, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                <div className="shrink-0 w-28 text-xs font-semibold text-slate-500 tabular-nums">{fmtDateTime(h.at)}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{h.event}</div>
                  {h.desc ? <div className="text-xs text-slate-500 mt-0.5">{h.desc}</div> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

// ─── Danh sách ───────────────────────────────────────────────────────────────
function ListView({ items, loading, error, onReload, onSelect }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(9)

  const types = useMemo(() => [...new Set(items.map((c) => c.type).filter(Boolean))].sort(), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((c) => {
      const hay = [c.containerNo, c.cargo, c.vessel, c.line, c.position, c.bookingCode, c.vehiclePlate, c.driverName]
        .filter(Boolean).join(' ').toLowerCase()
      return (!q || hay.includes(q))
        && (statusFilter === 'All' || c.status === statusFilter)
        && (typeFilter === 'All' || c.type === typeFilter)
    })
  }, [items, search, statusFilter, typeFilter])

  // Về trang 1 khi đổi bộ lọc; giữ trang hợp lệ khi số lượng thay đổi
  useEffect(() => { setPage(1) }, [search, statusFilter, typeFilter, pageSize])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  )
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
    const list = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
    return list.reduce((acc, n, i) => { if (i && n - list[i - 1] > 1) acc.push('…'); acc.push(n); return acc }, [])
  }, [totalPages, currentPage])

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã container, hãng tàu, vị trí, booking, biển số…"
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-orange-400">
            <option value="All">Mọi trạng thái</option>
            <option value="IN_YARD">Trong bãi</option>
            <option value="RESERVED">Đã giữ chỗ</option>
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-orange-400">
            <option value="All">Mọi loại</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <button onClick={onReload} title="Tải lại" className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center cursor-pointer">
            <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}{' '}
          <button onClick={onReload} className="font-semibold underline cursor-pointer">Thử lại</button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải danh sách container…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          {items.length === 0 ? 'Hiện chưa có container nào trong bãi.' : 'Không có container phù hợp với bộ lọc.'}
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-500 tabular-nums">
            {filtered.length === items.length ? `${items.length} container` : `${filtered.length} / ${items.length} container`}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageItems.map((c) => (
              <button
                key={c.containerNo}
                onClick={() => onSelect(c.containerNo)}
                className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-slate-900 tabular-nums group-hover:text-orange-600 transition-colors">{c.containerNo}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{[c.type, c.line].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-sm text-slate-700 mt-3 truncate" title={cargoLabel(c.cargo) || ''}>{cargoLabel(c.cargo) || 'Chưa rõ loại hàng'}</div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2">
                    <div className="text-[10px] text-slate-500">Vị trí</div>
                    <div className="text-xs font-bold text-orange-700 tabular-nums mt-0.5">{c.position}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2">
                    <div className="text-[10px] text-slate-500">Trọng lượng</div>
                    <div className="text-xs font-bold text-slate-900 tabular-nums mt-0.5">{fmtWeight(c.weightKg)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2">
                    <div className="text-[10px] text-slate-500">Seal</div>
                    <div className="text-xs font-bold text-slate-900 tabular-nums mt-0.5 truncate">{val(c.sealNo)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="truncate flex items-center gap-3">
                    <span>{c.vehiclePlate ? `Xe ${c.vehiclePlate}` : 'Chưa có xe'}</span>
                    {(c.photos?.length || 0) > 0 && (
                      <span className="flex items-center gap-1 text-slate-500 shrink-0">
                        <span className="material-symbols-outlined text-sm">photo_camera</span>
                        <span className="tabular-nums">{c.photos.length}</span>
                      </span>
                    )}
                  </span>
                  <span className="text-orange-600 font-semibold flex items-center gap-0.5 shrink-0">
                    Xem chi tiết
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="tabular-nums">
                Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} / {filtered.length}
              </span>
              <label className="flex items-center gap-1.5">
                <span>Số thẻ / trang</span>
                <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-orange-400">
                  {[9, 18, 36].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </label>
            </div>
            <nav className="flex items-center gap-1" aria-label="Phân trang">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Trang trước" className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              {pageNumbers.map((n, i) => (n === '…' ? (
                <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === currentPage ? 'page' : undefined}
                  className={`h-8 min-w-8 px-2 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${n === currentPage ? 'bg-orange-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {n}
                </button>
              )))}
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Trang sau" className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Trang chính ─────────────────────────────────────────────────────────────
export default function ContainerDetail() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedNo, setSelectedNo] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/yard/containers')
      setItems(Array.isArray(res.data?.data?.items) ? res.data.data.items : [])
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được danh sách container trong bãi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 30000)
    return () => clearInterval(timer)
  }, [load])

  const selected = useMemo(() => items.find((c) => c.containerNo === selectedNo) || null, [items, selectedNo])

  return (
    <div className="p-6 md:p-8 w-full font-sans bg-slate-50 min-h-full text-slate-900">
      {selected ? (
        <DetailView container={selected} onBack={() => setSelectedNo(null)} />
      ) : (
        <ListView items={items} loading={loading} error={error} onReload={load} onSelect={setSelectedNo} />
      )}
    </div>
  )
}
