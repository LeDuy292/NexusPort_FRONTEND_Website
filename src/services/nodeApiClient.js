const NODE_API_URL = import.meta.env.VITE_NODE_API_URL || '/node-api'

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    return stored ? JSON.parse(stored)?.token : null
  } catch {
    return null
  }
}

const request = async (method, path, { params, body } = {}) => {
  const url = new URL(`${NODE_API_URL}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const token = getToken()
  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(!(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    })
  } catch {
    throw new Error('Không thể kết nối đến dịch vụ quản lý Container. Vui lòng thử lại sau.')
  }

  if (response.status === 401) {
    try {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      sessionStorage.removeItem('user')
      sessionStorage.removeItem('token')
    } catch (_) {}
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login?kicked=true'
    }
    const error = new Error('Phiên làm việc đã kết thúc. Vui lòng đăng nhập lại.')
    error.status = 401
    throw error
  }

  if (response.status === 204) return null
  if (response.ok && response.headers.get('content-type')?.includes('spreadsheetml')) return response.blob()
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    let msg = payload?.error?.message || payload?.message
    if (!msg) {
      if (response.status === 502) {
        msg = 'Dịch vụ Smart Route (:4000) chưa được bật hoặc không thể kết nối (HTTP 502).'
      } else {
        msg = `Yêu cầu không thành công (HTTP ${response.status}).`
      }
    }
    const error = new Error(msg)
    error.status = response.status
    error.code = payload?.error?.code
    error.details = payload?.error?.details
    throw error
  }
  return payload.data
}

export default {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  postForm: (path, formData) => request('POST', path, { body: formData }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
}
