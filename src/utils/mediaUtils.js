const CSHARP_BASE_URL = (import.meta.env.VITE_CSHARP_API_URL || 'http://localhost:5000').replace(/\/$/, '')

/**
 * Utility resolving media/image URLs (handling full S3 URLs, blob/data URIs, and local paths)
 */
export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed

  // Filter out legacy local upload paths that no longer exist on local disk
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    return ''
  }

  return `${CSHARP_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}
