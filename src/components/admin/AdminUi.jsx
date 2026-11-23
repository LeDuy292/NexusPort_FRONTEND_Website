import React from 'react'
import apiClient from '../../services/apiClient'

// ── Định dạng ────────────────────────────────────────────────────────────────
export const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`
export const num = (v) => Number(v || 0).toLocaleString('vi-VN')
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
export const fmtDay = (v) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}
export const errText = (e) => e?.response?.data?.message || e?.message || 'Không thể xử lý yêu cầu.'

export const adminApi = {
  get: async (path, params) => (await apiClient.get(`/admin${path}`, { params })).data?.data,
  post: async (path, body) => (await apiClient.post(`/admin${path}`, body)).data?.data,
  patch: async (path, body) => (await apiClient.patch(`/admin${path}`, body)).data?.data,
  del: async (path) => (await apiClient.delete(`/admin${path}`)).data?.data,
}

// ── Thành phần giao diện ─────────────────────────────────────────────────────
export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

const TONES = {
  blue: 'text-blue-600', green: 'text-emerald-600', orange: 'text-orange-600', red: 'text-red-600', slate: 'text-slate-900', violet: 'text-violet-600',
}
const ACCENT = { blue: 'bg-blue-500', green: 'bg-emerald-500', orange: 'bg-orange-500', red: 'bg-red-500', slate: 'bg-slate-300', violet: 'bg-violet-500' }
export function Stat({ label, value, sub, tone = 'slate' }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${ACCENT[tone] || ACCENT.slate}`} />
      <div className="pl-2">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${TONES[tone] || TONES.slate}`}>{value}</div>
        {sub ? <div className="mt-1 text-[11px] text-slate-500">{sub}</div> : null}
      </div>
    </div>
  )
}

export function Pill({ children, tone = 'slate' }) {
  const cls = {
    slate: 'bg-slate-50 text-slate-600 border-slate-200', green: 'bg-emerald-50 text-emerald-700 border-emerald-200', red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', violet: 'bg-violet-50 text-violet-700 border-violet-200',
  }[tone]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>
}

export function Empty({ children = 'Chưa có dữ liệu.' }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{children}</p>
}

export function ErrorBox({ children }) {
  return children ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{children}</div> : null
}

// ── Biểu đồ (SVG thuần, không phụ thuộc thư viện) ─────────────────────────────
const PALETTE = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#64748b']
export const chartColor = (i) => PALETTE[i % PALETTE.length]

function useWidth() {
  const ref = React.useRef(null)
  const [w, setW] = React.useState(600)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => setW(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Đường cong trơn (monotone cubic) đi qua các điểm
function smoothPath(points) {
  if (points.length < 2) return ''
  const n = points.length
  const dx = []
  const dy = []
  const m = []
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1][0] - points[i][0])
    dy.push(points[i + 1][1] - points[i][1])
    m.push(dy[i] / (dx[i] || 1))
  }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i += 1) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < n - 1; i += 1) {
    const x1 = points[i][0] + dx[i] / 3
    const y1 = points[i][1] + (t[i] * dx[i]) / 3
    const x2 = points[i + 1][0] - dx[i] / 3
    const y2 = points[i + 1][1] - (t[i + 1] * dx[i]) / 3
    d += ` C${x1},${y1} ${x2},${y2} ${points[i + 1][0]},${points[i + 1][1]}`
  }
  return d
}

const niceMax = (v) => {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}
const shortNum = (v) => (v >= 1e9 ? `${+(v / 1e9).toFixed(1)} tỷ` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} tr` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : String(Math.round(v)))

/**
 * Biểu đồ xu hướng theo ngày. type="area": đường cong + vùng tô gradient; type="bar": cột bo góc.
 * series: [{ key, label, color }]
 */
export function DailyBars({ data, series, height = 220, type = 'area', formatValue = num }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = React.useState(null)
  const uid = React.useId().replace(/:/g, '')
  const padL = 44
  const padR = 12
  const padT = 12
  const padB = 24
  const iw = Math.max(10, width - padL - padR)
  const ih = height - padT - padB
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(...series.map((s) => Number(d[s.key] || 0))))))
  const n = data.length
  const x = (i) => padL + (n <= 1 ? iw / 2 : (i * iw) / (n - 1))
  const barSlot = iw / Math.max(1, n)
  const bx = (i) => padL + barSlot * i + barSlot / 2
  const y = (v) => padT + ih - (Number(v || 0) / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56))))

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = type === 'bar' ? Math.floor((px - padL) / barSlot) : Math.round(((px - padL) / iw) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, i)))
  }
  const hx = hover == null ? 0 : (type === 'bar' ? bx(hover) : x(hover))

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={width} height={height} role="img" aria-label="Biểu đồ theo ngày" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={type === 'bar' ? 0.95 : 0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={type === 'bar' ? 0.55 : 0.02} />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{shortNum(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % labelEvery === 0 ? (
          <text key={i} x={type === 'bar' ? bx(i) : x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{fmtDay(d.day)}</text>
        ) : null))}

        {type === 'bar' ? series.map((s, si) => {
          const w = Math.max(2, Math.min(26, (barSlot - 4) / series.length))
          return data.map((d, i) => {
            const v = Number(d[s.key] || 0)
            const h = (v / max) * ih
            const cx = bx(i) - (series.length * w) / 2 + si * w
            return <rect key={`${s.key}-${i}`} x={cx} y={padT + ih - h} width={w - 1} height={Math.max(v > 0 ? 2 : 0, h)} rx={Math.min(4, w / 2)} fill={`url(#${uid}-${s.key})`} opacity={hover == null || hover === i ? 1 : 0.45} />
          })
        }) : series.map((s) => {
          const pts = data.map((d, i) => [x(i), y(d[s.key])])
          const line = smoothPath(pts)
          return (
            <g key={s.key}>
              {pts.length > 1 && <path d={`${line} L${x(n - 1)},${padT + ih} L${x(0)},${padT + ih} Z`} fill={`url(#${uid}-${s.key})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              {hover != null && <circle cx={x(hover)} cy={y(data[hover][s.key])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.25" />}
            </g>
          )
        })}

        {hover != null && type !== 'bar' && <line x1={hx} x2={hx} y1={padT} y2={padT + ih} stroke="#cbd5e1" strokeDasharray="3 3" />}
        <rect x={padL} y={padT} width={iw} height={ih} fill="transparent" />
      </svg>

      {hover != null && (
        <div className="pointer-events-none absolute z-10 rounded-xl bg-slate-900/95 text-white text-xs shadow-xl px-3 py-2 -translate-x-1/2"
          style={{ left: Math.min(width - 90, Math.max(90, hx)), top: 0 }}>
          <div className="font-semibold mb-1 tabular-nums">{fmtDay(data[hover].day)}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2 tabular-nums">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-slate-300">{s.label}</span>
              <span className="ml-auto font-semibold pl-3">{formatValue(data[hover][s.key])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-3 pl-10">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  )
}

/** Biểu đồ vành khuyên: items [{ label, value, color? }] */
export function Donut({ items, size = 168, thickness = 22, centerLabel = 'Tổng', empty = 'Chưa có dữ liệu.' }) {
  const [hover, setHover] = React.useState(null)
  const total = items.reduce((s, i) => s + Number(i.value || 0), 0)
  if (!total) return <Empty>{empty}</Empty>
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const gap = items.length > 1 ? 3 : 0
  const segs = items.map((it, i) => {
    const len = (Number(it.value || 0) / total) * c
    const seg = { ...it, color: it.color || chartColor(i), dash: Math.max(0, len - gap), off: offset }
    offset += len
    return seg
  })
  const active = hover != null ? segs[hover] : null
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ cơ cấu">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segs.map((sg, i) => (
              <circle key={sg.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={sg.color} strokeWidth={hover === i ? thickness + 4 : thickness}
                strokeDasharray={`${sg.dash} ${c - sg.dash}`} strokeDashoffset={-sg.off} strokeLinecap="butt" style={{ transition: 'stroke-width .15s' }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{num(active ? active.value : total)}</div>
          <div className="text-[11px] text-slate-500 max-w-[90px] text-center truncate">{active ? active.label : centerLabel}</div>
        </div>
      </div>
      <ul className="flex-1 min-w-0 w-full space-y-1.5">
        {segs.map((sg, i) => (
          <li key={sg.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2.5 text-xs rounded-lg px-2 py-1 transition-colors ${hover === i ? 'bg-slate-50' : ''}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sg.color }} />
            <span className="flex-1 min-w-0 truncate text-slate-700">{sg.label}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{num(sg.value)}</span>
            <span className="w-10 text-right text-slate-400 tabular-nums">{Math.round((sg.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Danh sách thanh ngang xếp hạng: rows [{ label, value, sub }] */
export function HBars({ rows, color = '#f97316', formatValue = num, empty = 'Chưa có dữ liệu.' }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  const max = Math.max(1, ...rows.map((r) => Number(r.value || 0)))
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`}>
          <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-4 text-[11px] font-semibold text-slate-400 tabular-nums">{i + 1}</span>
              <span className="font-medium text-slate-700 truncate">{r.label}</span>
            </span>
            <span className="font-semibold text-slate-900 tabular-nums shrink-0">{formatValue(r.value)}{r.sub ? <span className="text-slate-400 font-normal"> {r.sub}</span> : null}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, (Number(r.value || 0) / max) * 100)}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Thanh tiến độ gọn (ví dụ mức dùng ô bãi) */
export function Meter({ value, max, color = '#f97316' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} /></div>
      <span className="w-9 text-right text-[11px] font-semibold text-slate-600 tabular-nums">{pct}%</span>
    </div>
  )
}

/** Hook tải dữ liệu admin có làm mới định kỳ */
export function useAdminData(path, params, { refreshMs = 0 } = {}) {
  const [state, setState] = React.useState({ data: null, loading: true, error: '' })
  const key = JSON.stringify(params || {})
  const load = React.useCallback(async () => {
    try {
      const data = await adminApi.get(path, params)
      setState({ data, loading: false, error: '' })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errText(e) }))
    }
  }, [path, key]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    load()
    if (!refreshMs) return undefined
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, refreshMs)
    return () => clearInterval(t)
  }, [load, refreshMs])
  return { ...state, reload: load }
}
