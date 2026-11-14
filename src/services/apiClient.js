import { verifySession } from './sessionValidation'

const getApiBaseUrl = () => {
  const raw = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
  return raw.startsWith('http') && !raw.endsWith('/api') ? raw + '/api' : raw
}
const API_URL = getApiBaseUrl()
const getToken = () => {
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null')?.token || null }
  catch { return null }
}

const request = async (method, path, data, config = {}) => {
  const url = new URL(API_URL + path, window.location.origin)
  Object.entries(config.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value)
  })
  const token = getToken()
  const form = data instanceof FormData
  const headers = { ...(!form ? { 'Content-Type': 'application/json' } : {}), ...config.headers,
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  // The browser supplies the multipart boundary.
  if (form) delete headers['Content-Type']
  const timeout = AbortSignal.timeout(config.timeout ?? (method === 'GET' ? 20000 : 120000))
  const signal = config.signal ? AbortSignal.any([config.signal, timeout]) : timeout
  let res
  try {
    res = await fetch(url, { method, headers, signal, cache: 'no-store',
      ...(data !== undefined ? { body: form ? data : JSON.stringify(data) } : {}) })
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('Máy chủ phản hồi quá chậm. Vui lòng thử lại.')
    throw error
  }
  if (res.status === 204) return { data: null }
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    // A delayed response from a previous login must not clear the current session.
    if (res.status === 401 && token && token === getToken()) {
      const state = await verifySession(token)
      if (state === 'valid' || state === 'unknown') payload.message = 'Dịch vụ hiện chưa xác thực được yêu cầu. Vui lòng thử lại.'
    }
    const error = new Error(payload.message || payload.Message || 'Yêu cầu không thành công (HTTP ' + res.status + ').')
    error.response = { status: res.status, data: payload }
    throw error
  }
  return { data: payload }
}

export default {
  get: (path, config) => request('GET', path, undefined, config),
  post: (path, data = {}, config) => request('POST', path, data, config),
  put: (path, data = {}, config) => request('PUT', path, data, config),
  patch: (path, data = {}, config) => request('PATCH', path, data, config),
  delete: (path, config) => request('DELETE', path, undefined, config),
}
