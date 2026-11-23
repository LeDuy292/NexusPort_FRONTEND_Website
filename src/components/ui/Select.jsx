import React, { Children, Fragment, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Dropdown dùng chung toàn hệ thống – thay thế trực tiếp <select> của trình duyệt.
 *
 * Cách dùng giống hệt <select>:
 *   <Select value={v} onChange={(e) => setV(e.target.value)} disabled required name="x">
 *     <option value="">Tất cả</option>
 *     <option value="a">Mục A</option>
 *   </Select>
 * hoặc truyền danh sách: <Select value={v} onChange={...} options={[{ value, label, sub }]} />
 *
 * - Một <select> thật vẫn được giữ (ẩn) để form, required, name, FormData và test hoạt động như cũ.
 * - Danh sách mở bằng portal (position: fixed) nên không bị cắt bởi vùng cuộn / overflow của khung chứa.
 * - Hỗ trợ bàn phím: ↑ ↓ Enter Esc, Home/End.
 */

function nodeText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) return nodeText(node.props.children)
  return ''
}

function collectOptions(children, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) { collectOptions(child.props.children, out); return }
    if (child.type === 'optgroup') { collectOptions(child.props.children, out); return }
    if (child.type === 'option') {
      const label = nodeText(child.props.children)
      out.push({
        value: child.props.value !== undefined ? String(child.props.value) : label,
        label,
        disabled: Boolean(child.props.disabled),
      })
    }
  })
  return out
}

// Chỉ giữ lại các lớp bố cục (độ rộng, flex, lưới) từ className gốc của <select>.
const LAYOUT_CLASS = /^(w-|min-w-|max-w-|flex-|grow|shrink|basis-|col-span-|row-span-|self-|justify-self|order-|sm:w-|md:w-|lg:w-|xl:w-|sm:flex-|md:flex-|lg:flex-|sm:col-span-|md:col-span-|lg:col-span-|sm:min-w-|md:min-w-|lg:min-w-|sm:max-w-|md:max-w-|lg:max-w-)/
const COMPACT_CLASS = /(^|\s)(text-xs|text-\[1[01]px\]|h-8|h-9|py-1|py-1\.5)(\s|$)/

export default function Select({
  value,
  defaultValue,
  onChange,
  onBlur,
  children,
  options: optionsProp,
  className = '',
  wrapperClassName = '',
  size,
  align = 'left',
  disabled = false,
  required = false,
  name,
  id,
  title,
  multiple,
  placeholder,
  panelMinWidth,
  ...rest
}) {
  // select nhiều lựa chọn: giữ nguyên bản gốc
  if (multiple) {
    const { ['aria-label']: ariaLabel, ...others } = rest
    return (
      <select value={value} defaultValue={defaultValue} onChange={onChange} onBlur={onBlur} className={className} disabled={disabled} required={required} name={name} id={id} title={title} multiple aria-label={ariaLabel} {...others}>
        {children}
      </select>
    )
  }

  const controlled = value !== undefined
  const [inner, setInner] = useState(defaultValue !== undefined ? String(defaultValue) : undefined)
  const options = useMemo(() => (optionsProp
    ? optionsProp.map((o) => ({ value: String(o.value), label: o.label, sub: o.sub, disabled: o.disabled }))
    : collectOptions(children)), [optionsProp, children])

  const current = controlled ? (value == null ? '' : String(value)) : (inner !== undefined ? inner : (options[0]?.value ?? ''))
  const selected = options.find((o) => o.value === current)
  const triggerRef = useRef(null)
  const nativeRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)

  const compact = size ? size === 'sm' : COMPACT_CLASS.test(` ${className} `)
  const wrapperLayout = String(className).split(/\s+/).filter((c) => c && LAYOUT_CLASS.test(c)).join(' ')

  const emit = useCallback((next) => {
    if (!controlled) setInner(next)
    if (onChange) {
      const target = { value: next, name, id, type: 'select-one' }
      onChange({ target, currentTarget: target, preventDefault() {}, stopPropagation() {}, persist() {} })
    }
  }, [controlled, onChange, name, id])

  const close = useCallback(() => setOpen(false), [])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const panelHeight = Math.min(288, options.length * 40 + 8)
    const spaceBelow = window.innerHeight - r.bottom
    const flip = spaceBelow < panelHeight + 12 && r.top > spaceBelow
    setPos({
      left: align === 'right' ? undefined : Math.max(8, Math.min(r.left, window.innerWidth - 8 - Math.max(r.width, panelMinWidth || 0))),
      right: align === 'right' ? Math.max(8, window.innerWidth - r.right) : undefined,
      top: flip ? undefined : r.bottom + 6,
      bottom: flip ? window.innerHeight - r.top + 6 : undefined,
      minWidth: Math.max(r.width, panelMinWidth || 0),
      maxHeight: Math.max(120, Math.min(288, (flip ? r.top : spaceBelow) - 16)),
    })
  }, [align, options.length, panelMinWidth])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      close()
    }
    const onMove = (e) => { if (!panelRef.current?.contains(e.target)) close() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, close])

  // đưa mục đang chọn vào tầm nhìn khi mở
  useEffect(() => {
    if (!open) return
    const idx = Math.max(0, options.findIndex((o) => o.value === current))
    setActive(idx)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && panelRef.current && active >= 0) {
      panelRef.current.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, active])

  const move = (delta) => {
    if (!options.length) return
    let i = active
    for (let n = 0; n < options.length; n += 1) {
      i = (i + delta + options.length) % options.length
      if (!options[i].disabled) break
    }
    setActive(i)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const o = options[active]
      if (o && !o.disabled) { emit(o.value); close() }
    } else if (e.key === 'Tab') close()
  }

  const showPlaceholder = selected ? selected.value === '' : true
  const label = selected ? selected.label : (placeholder || '')

  return (
    <div className={`relative ${wrapperLayout || 'w-full'} ${wrapperClassName}`}>
      {/* <select> thật (ẩn): phục vụ form, required, name và các thao tác đổi giá trị trực tiếp */}
      <select
        ref={nativeRef}
        aria-hidden="true"
        tabIndex={-1}
        value={current}
        name={name}
        required={required}
        disabled={disabled}
        onChange={(e) => emit(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      >
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        onClick={() => { if (!disabled) setOpen((v) => !v) }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-xl text-left transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50 focus:outline-none ${compact ? 'h-9 px-2.5 text-xs' : 'h-10 px-3 text-sm'} ${open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100'}`}
      >
        <span className={`truncate ${showPlaceholder ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>{label || ' '}</span>
        <span className={`material-symbols-outlined shrink-0 text-slate-400 transition-transform ${compact ? 'text-base' : 'text-lg'} ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <ul
          ref={panelRef}
          role="listbox"
          style={{ position: 'fixed', zIndex: 10000, left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth, maxHeight: pos.maxHeight }}
          className="overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl max-w-[min(480px,calc(100vw-16px))]"
        >
          {options.map((o, i) => {
            const isSel = o.value === current
            return (
              <li key={`${o.value}-${i}`} role="option" aria-selected={isSel} data-idx={i}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => { emit(o.value); close(); triggerRef.current?.focus() }}
                  className={`w-full text-left rounded-lg px-3 py-2 flex items-center justify-between gap-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${isSel ? 'bg-indigo-50 text-indigo-800' : i === active ? 'bg-slate-100 text-slate-800' : 'text-slate-700'}`}
                >
                  <span className="min-w-0">
                    <span className={`block text-xs sm:text-[13px] ${o.value === '' ? 'text-slate-500' : ''} ${isSel ? 'font-semibold' : 'font-medium'}`}>{o.label || ' '}</span>
                    {o.sub ? <span className="block text-[11px] text-slate-500">{o.sub}</span> : null}
                  </span>
                  {isSel ? <span className="material-symbols-outlined text-base text-indigo-600 shrink-0">check</span> : null}
                </button>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </div>
  )
}
