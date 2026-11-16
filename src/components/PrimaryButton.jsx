const sizes = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-4 text-sm',
}

export default function PrimaryButton({ icon, children, size = 'sm', loading = false, disabled = false, type = 'button', className = '', ...props }) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center gap-2 rounded-lg bg-signal-orange font-bold text-white shadow-sm transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${className}`}>
    {(icon || loading) && <span aria-hidden="true" className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>{loading ? 'progress_activity' : icon}</span>}
    {children}
  </button>
}
