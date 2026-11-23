/**
 * Thành phần giao diện dùng chung cho các trang chứng từ (hàng xuất / hàng nhập),
 * theo cùng phong cách với các trang Hãng tàu khác: thẻ trắng viền chalk, bo góc 2xl,
 * tiêu đề font-heading, bảng có đầu cột nền fog, nút chính màu signal-orange.
 */

const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
// Nút chính: cam. Nút phụ: nền đen carbon, chữ trắng, luôn nổi trên nền trắng.
export const btnPrimary = `${base} bg-signal-orange text-white hover:opacity-90`
export const btn = `${base} bg-carbon text-white hover:bg-graphite`
export const btnSoft = `${base} bg-slate-200 text-carbon hover:bg-slate-300 shadow-none`
export const card = 'bg-white border border-chalk rounded-2xl p-5 shadow-sm'
export const inputCls = 'w-full h-10 px-3 bg-fog border border-chalk rounded-xl text-xs font-medium text-carbon focus:outline-none focus:border-signal-orange focus:ring-0'
export const textareaCls = 'w-full px-3 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium text-carbon focus:outline-none focus:border-signal-orange focus:ring-0'
export const labelCls = 'block text-[10px] font-bold text-slate uppercase tracking-wide mb-1'

const tones = {
  slate: 'bg-slate-100 text-slate-700 border-slate-300',
  blue: 'bg-blue-50 text-blue-700 border-blue-300',
  amber: 'bg-amber-50 text-amber-800 border-amber-300',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  red: 'bg-rose-50 text-rose-700 border-rose-300',
  purple: 'bg-purple-50 text-purple-700 border-purple-300',
  orange: 'bg-orange-50 text-orange-800 border-orange-300',
}

export function Pill({ tone = 'slate', children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tones[tone] || tones.slate}`}>{children}</span>
}

export function PageHeader({ badge, title, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-4">
      <div>
        {badge && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">{badge}</span>
          </div>
        )}
        <h2 className="font-heading text-2xl font-extrabold text-carbon">{title}</h2>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, tone = 'text-carbon', active, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border p-4 shadow-sm space-y-1 ${active ? 'border-signal-orange ring-1 ring-signal-orange' : 'border-chalk'} ${onClick ? 'cursor-pointer hover:bg-fog/60' : ''}`}
    >
      <span className="block text-[10px] font-bold text-slate uppercase tracking-wider">{label}</span>
      <span className="block text-3xl font-extrabold font-mono text-carbon">{value}</span>
      {hint && <span className={`block text-[11px] font-bold ${tone}`}>{hint}</span>}
    </Tag>
  )
}

export function Info({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold text-slate uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-carbon">{children == null || children === '' ? '—' : children}</dd>
    </div>
  )
}

export function SectionTitle({ icon, children, aside }) {
  return (
    <div className="flex items-center justify-between border-b border-chalk pb-3 mb-3">
      <h3 className="font-heading text-base font-extrabold text-carbon flex items-center gap-2">
        {icon && <span className="material-symbols-outlined text-signal-orange text-xl">{icon}</span>}
        {children}
      </h3>
      {aside}
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, children }) {
  return (
    <div className="p-10 text-center text-slate space-y-2 font-sans">
      <span className="material-symbols-outlined text-4xl">{icon}</span>
      <p className="font-bold text-sm text-carbon">{title}</p>
      {children && <p className="text-xs max-w-md mx-auto">{children}</p>}
    </div>
  )
}

export const thCls = 'py-3 px-3 text-left whitespace-nowrap'
export const theadCls = 'bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk'
