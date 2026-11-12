import { useEffect, useRef } from 'react'

// Native dialogs keep background controls inert, including when an admin form
// is opened above the service workspace. Each layer restores its own focus.
export default function CatalogDialog({ className = '', accent, labelledBy, describedBy, onClose, children }) {
  const ref = useRef(null)
  const startedOutside = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    const page = document.querySelector('.epc-shell > div > main')
    const previousOverflow = page?.style.overflow
    dialog.showModal()
    dialog.querySelector('[data-dialog-initial-focus]')?.focus({ preventScroll: true })
    if (page) page.style.overflow = 'hidden'

    return () => {
      if (dialog.open) dialog.close()
      if (page) page.style.overflow = previousOverflow
      const fallback = document.querySelector('dialog[open] [data-dialog-initial-focus]')
        || document.querySelector('[data-catalog-heading]')
      const target = previousFocus?.isConnected ? previousFocus : fallback
      target?.focus?.({ preventScroll: true })
    }
  }, [])

  return <dialog
    ref={ref}
    className={`epc-dialog ${className}`}
    data-accent={accent}
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length)
      if (!controls.length) return
      const index = controls.indexOf(document.activeElement)
      if (index === -1 || (!event.shiftKey && index === controls.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault()
        controls[event.shiftKey ? controls.length - 1 : 0].focus()
      }
    }}
    onPointerDown={event => { startedOutside.current = event.target === ref.current }}
    onClick={event => {
      if (startedOutside.current && event.target === ref.current) onClose()
    }}
  >{children}</dialog>
}
