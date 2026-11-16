import { verifySession } from './sessionValidation'

const getApiBaseUrl = () => {
  let raw = '/api'
  try {
    raw = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
  } catch {
    raw = '/api'
  }
  return raw.startsWith('http') && !raw.endsWith('/api') ? raw + '/api' : raw
}
const API_URL = getApiBaseUrl()

const getToken = () => {
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null')?.token || null }
  catch { return null }
}

const getCsharpApiUrl = () => {
  try {
    return (import.meta.env.VITE_CSHARP_API_URL || '').trim().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

const getNodeApiUrl = () => {
  try {
    return (import.meta.env.VITE_NODE_API_URL || '').trim().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

// Helper xác định URL thực tế của endpoint:
// 1. Nếu path là URL tuyệt đối -> giữ nguyên
// 2. Nếu path bắt đầu bằng /v1/ và có VITE_CSHARP_API_URL -> điều hướng trực tiếp tới C# Core
// 3. Nếu path bắt đầu bằng /node-api/ và có VITE_NODE_API_URL tuyệt đối -> điều hướng tới Node Core
// 4. Mặc định -> ghép với API_URL (qua Gateway https://api.nexusport.io.vn/api hoặc proxy Vercel)
const resolveRequestUrl = (path) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`

  if (cleanPath.startsWith('/v1/')) {
    const csharpUrl = getCsharpApiUrl()
    if (csharpUrl) {
      const base = csharpUrl.endsWith('/api') ? csharpUrl : `${csharpUrl}/api`
      return `${base}${cleanPath}`
    }
  }

  if (cleanPath.startsWith('/node-api/')) {
    const nodeUrl = getNodeApiUrl()
    if (nodeUrl && nodeUrl.startsWith('http')) {
      const stripped = cleanPath.replace(/^\/node-api/, '')
      const base = nodeUrl.endsWith('/api/v1') ? nodeUrl : `${nodeUrl}/api/v1`
      return `${base}${stripped}`
    }
  }

  return `${API_URL}${cleanPath}`
}

const request = async (method, path, data, config = {}) => {
  const targetUrl = resolveRequestUrl(path)
  const url = new URL(targetUrl, window.location.origin)
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
