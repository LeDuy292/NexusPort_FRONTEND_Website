const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    return stored ? JSON.parse(stored)?.token : null
  } catch {
    return null
  }
}

const request = async (method, path, body = null) => {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = `/api${cleanPath}`
  const options = {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  }

  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.success === false) {
    const msg = data.message || `Yêu cầu không thành công (HTTP ${res.status})`
    const error = new Error(msg)
    error.status = res.status
    error.data = data
    throw error
  }

  return data.data !== undefined ? data.data : data
}

const expressApiClient = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
}

export default expressApiClient
