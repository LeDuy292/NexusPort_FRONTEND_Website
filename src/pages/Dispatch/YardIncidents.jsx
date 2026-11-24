import React, { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { yardIncidentService } from '../../services/yardIncidentService'

const SEVERITY = {
  CRITICAL: { label: 'Nghiêm trọng', cls: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  HIGH: { label: 'Cao', cls: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
  MEDIUM: { label: 'Trung bình', cls: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  LOW: { label: 'Thấp', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
}
const STATUS = {
  NEW: { label: 'Mới', cls: 'bg-red-50 text-red-700 border-red-200' },
  ACKNOWLEDGED: { label: 'Đang xử lý', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESOLVED: { label: 'Đã xử lý', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}
const FACE_LABEL = { top: 'Nóc', left: 'Hông trái', front: 'Mặt trước', right: 'Hông phải', back: 'Mặt sau' }
const TABS = [['ALL', 'Tất cả'], ['NEW', 'Mới'], ['ACKNOWLEDGED', 'Đang xử lý'], ['RESOLVED', 'Đã xử lý']]

const fmt = (v) => (v ? new Date(v).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false }) : '—')

const realtimeUrl = () => {
  if (import.meta.env.VITE_REALTIME_URL) return import.meta.env.VITE_REALTIME_URL
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  return 'http://localhost:3001'
}
const authToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    if (stored) { const t = JSON.parse(stored)?.token; if (t) return t }
  } catch { /* bỏ qua */ }
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null
}

export default function YardIncidents() {
  const [data, setData] = useState({ items: [], counts: { new: 0, acknowledged: 0, resolved: 0 } })
  const [tab, setTab] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [resolving, setResolving] = useState(null) // { id, note }
  const [lightbox, setLightbox] = useState(null)
  const [flash, setFlash] = useState('')
  const flashTimer = useRef(null)

  const load = useCallback(async () => {
    try {
      setData(await yardIncidentService.list({ limit: 200 }))
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được danh sách sự cố.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 20000)
    // Nhận báo cáo mới ngay lập tức
    let socket
    const token = authToken()
    if (token) {
      socket = io(realtimeUrl(), { auth: { token }, transports: ['websocket', 'polling'] })
      socket.on('yard_incident:new', (r) => {
        setFlash(`Sự cố mới ${r?.code || ''}: ${r?.type || ''}`.trim())
        clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlash(''), 8000)
        load()
      })
      socket.on('yard_incident:updated', load)
    }
    return () => { clearInterval(timer); clearTimeout(flashTimer.current); socket?.disconnect() }
  }, [load])

  const applyProposal = async (id, slot) => {
    setBusyId(id)
    try {
      const res = await yardIncidentService.applyProposal(id, slot)
      setFlash(`Đã chuyển ${res.containerNo} từ ${res.from} sang ${res.to}`)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(''), 6000)
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không áp dụng được đề xuất.')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const act = async (id, status, note) => {
    setBusyId(id)
    try {
      await yardIncidentService.updateStatus(id, status, note)
      setResolving(null)
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không cập nhật được trạng thái.')
    } finally {
      setBusyId(null)
    }
  }

  const items = tab === 'ALL' ? data.items : data.items.filter((i) => i.status === tab)
  const countOf = (k) => (k === 'ALL' ? data.items.length : (data.counts?.[k.toLowerCase()] ?? data.items.filter((i) => i.status === k).length))

  return (
    <div className="p-6 md:p-8 w-full max-w-6xl mx-auto font-sans space-y-5">
      {flash && (
        <div role="status" className="fixed top-20 right-6 z-[100] max-w-sm rounded-xl bg-slate-900 text-white text-sm px-4 py-3 shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />{flash}
        </div>
      )}

      <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist">
        {TABS.map(([k, label]) => {
          const on = tab === k
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)}
              className={`px-3.5 h-9 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {label}
              <span className={`tabular-nums text-[11px] px-1.5 rounded-md ${on ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200/70 text-slate-500'}`}>{countOf(k)}</span>
            </button>
          )
        })}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading && data.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải báo cáo…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Chưa có báo cáo sự cố nào.</div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const sev = SEVERITY[r.severity] || SEVERITY.MEDIUM
            const st = STATUS[r.status] || STATUS.NEW
            const isResolving = resolving?.id === r.id
            return (
              <article key={r.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex">
                <div className={`w-1.5 shrink-0 ${sev.bar}`} />
                <div className="flex-1 p-5 space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{r.code}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sev.cls}`}>{sev.label}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    <span className="ml-auto text-xs text-slate-500 tabular-nums">{fmt(r.reportedAt)}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{r.type}</h3>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{r.description}</p>
                    {r.immediateAction ? <p className="text-xs text-slate-500 mt-1.5"><strong className="text-slate-600">Đã xử lý tại chỗ:</strong> {r.immediateAction}</p> : null}
                  </div>

                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {[
                      ['Vị trí', r.location],
                      ['Container', r.containerNo || '—'],
                      ['Thiết bị', r.equipment || '—'],
                      ['Người báo', r.reportedBy || '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-semibold text-slate-900 tabular-nums break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  {r.details?.kind === 'CONTAINER_DAMAGE' && (
                    <p className="text-xs text-slate-600">
                      <strong className="text-slate-700">Hư hỏng:</strong> {r.details.damageType || '—'}
                      {r.details.marks?.length ? ` · ${r.details.marks.length} điểm đánh dấu (${[...new Set(r.details.marks.map((m) => FACE_LABEL[m.face] || m.face))].join(', ')})` : ''}
                      {r.details.container ? ` · ${[r.details.container.type, r.details.container.line, r.details.container.position && `ô ${r.details.container.position}`, r.details.container.sealNo && `seal ${r.details.container.sealNo}`].filter(Boolean).join(' · ')}` : ''}
                    </p>
                  )}

                  {r.details?.kind === 'SLOT_CONFLICT' && (
                    <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
                      <div className="text-xs text-slate-700">
                        <strong>Ô đã giữ chỗ:</strong> <span className="tabular-nums">{r.details.reservedSlot}</span> — {r.details.reason}
                        {r.details.vehiclePlate ? <> · xe <span className="tabular-nums">{r.details.vehiclePlate}</span></> : null}
                        {r.details.lengthFt ? ` · cont ${r.details.lengthFt}ft` : ''}
                        {r.details.isReefer ? ' · cont lạnh' : ''}
                        {r.details.weightKg ? ` · ${Number(r.details.weightKg).toLocaleString('vi-VN')} kg` : ''}
                      </div>
                      {r.details.proposals?.length ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-slate-600">Ô đề xuất theo quy tắc đặt container (4.5.1)</div>
                          {r.details.proposals.map((p, i) => (
                            <div key={p.slot} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-900 tabular-nums">
                                  {p.slot} {i === 0 ? <span className="ml-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5">Khuyến nghị</span> : null}
                                </div>
                                <div className="text-[11px] text-slate-500">{p.score} điểm · {p.reasons.join('; ') || 'đạt chuẩn quy hoạch bãi'}</div>
                              </div>
                              {r.status !== 'RESOLVED' && (
                                <button type="button" disabled={busyId === r.id} onClick={() => applyProposal(r.id, p.slot)}
                                  className="px-3 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">
                                  Chuyển sang ô này
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-red-700">Chưa tìm được ô thay thế đạt quy tắc đặt container. Cần chỉ định thủ công trên sơ đồ bãi.</p>
                      )}
                    </div>
                  )}

                  {r.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {r.photos.map((u) => (
                        <button key={u} type="button" onClick={() => setLightbox(u)} className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-orange-300 cursor-pointer">
                          <img src={u} alt="Ảnh hiện trường" loading="lazy" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {(r.acknowledgedBy || r.resolvedBy) && (
                    <p className="text-xs text-slate-500">
                      {r.acknowledgedBy ? <>Tiếp nhận bởi <strong>{r.acknowledgedBy}</strong> lúc {fmt(r.acknowledgedAt)}. </> : null}
                      {r.resolvedBy ? <>Xử lý xong bởi <strong>{r.resolvedBy}</strong> lúc {fmt(r.resolvedAt)}{r.resolutionNote ? ` — ${r.resolutionNote}` : ''}.</> : null}
                    </p>
                  )}

                  {r.status !== 'RESOLVED' && (
                    <div className="pt-1">
                      {isResolving ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input value={resolving.note} onChange={(e) => setResolving({ id: r.id, note: e.target.value })} maxLength={2000} autoFocus
                            placeholder="Ghi chú kết quả xử lý (không bắt buộc)"
                            className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                          <button type="button" disabled={busyId === r.id} onClick={() => act(r.id, 'RESOLVED', resolving.note)}
                            className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer">Xác nhận đã xử lý</button>
                          <button type="button" onClick={() => setResolving(null)} className="px-4 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer">Hủy</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {r.status === 'NEW' && (
                            <button type="button" disabled={busyId === r.id} onClick={() => act(r.id, 'ACKNOWLEDGED')}
                              className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer">Tiếp nhận</button>
                          )}
                          <button type="button" onClick={() => setResolving({ id: r.id, note: '' })}
                            className="px-4 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer">Đã xử lý xong</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[90] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Ảnh hiện trường" className="max-w-4xl w-full max-h-[85vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setLightbox(null)} aria-label="Đóng" className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white text-slate-700 shadow flex items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  )
}
