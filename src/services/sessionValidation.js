const rawBase = (import.meta.env?.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
const authBase = rawBase.startsWith('http') && !rawBase.endsWith('/api') ? `${rawBase}/api` : rawBase
const endingCodes = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID', 'SESSION_KICKED', 'SESSION_LOGGED_OUT', 'ACCOUNT_DISABLED'])
const pending = new Map()

export const isSessionEndCode = code => endingCodes.has(code)

export const getCurrentToken = () => {
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null')?.token
    || localStorage.getItem('token') || sessionStorage.getItem('token') || null }
  catch { return null }
}

export function endConfirmedSession(token, code) {
  if (!token || token !== getCurrentToken() || !isSessionEndCode(code)) return
  for (const storage of [localStorage, sessionStorage]) { storage.removeItem('user'); storage.removeItem('token') }
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = code === 'SESSION_KICKED' ? '/login?kicked=duplicate' : '/login'
  }
}

// A business service's 401 is not proof that the login service ended the session.
// Verify with the authority that created the session; outages and unknown responses keep it intact.
export async function verifySession(token) {
  if (!token || token !== getCurrentToken()) return 'stale'
  if (pending.has(token)) return pending.get(token)
  const check = (async () => {
    try {
      const response = await fetch(new URL(`${authBase}/auth/me`, window.location.origin), {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
      })
      const body = await response.json().catch(() => ({}))
      if (token !== getCurrentToken()) return 'stale'
      if (response.ok && body.success === true) return 'valid'
      if (response.status === 401 && isSessionEndCode(body.code)) {
        endConfirmedSession(token, body.code)
        return 'ended'
      }
      return 'unknown'
    } catch { return 'unknown' }
  })()
  pending.set(token, check)
  try { return await check } finally { if (pending.get(token) === check) pending.delete(token) }
}
