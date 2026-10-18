// Lấy API base URL từ biến môi trường, mặc định là /api (được proxy sang backend qua Vite)
const API_URL = import.meta.env.VITE_API_URL || '/api'

const handleUnauthorized = async (res) => {
  const errorData = await res.json().catch(() => ({}))
  try {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('token')
  } catch (_) {}

  const isKicked = errorData?.code === 'SESSION_KICKED'
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    if (isKicked) {
      window.location.href = '/login?kicked=true'
    } else {
      window.location.href = '/login'
    }
  }
  const err = new Error(errorData.message || 'Unauthorized')
  err.response = { status: 401, data: errorData }
  throw err
}

const apiClient = {
  get: async (url, config = {}) => {
    let fullUrl = `${API_URL}${url}`
    if (config.params) {
      const queryParams = new URLSearchParams()
      Object.keys(config.params).forEach((key) => {
        if (config.params[key] !== undefined && config.params[key] !== null) {
          queryParams.append(key, config.params[key])
        }
      })
      const queryString = queryParams.toString()
      if (queryString) {
        fullUrl += `?${queryString}`
      }
    }

    const headers = { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      const user = stored ? JSON.parse(stored) : null
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'GET', headers })
    if (res.status === 401) {
      return handleUnauthorized(res)
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    if (res.status === 204) return { data: null }
    return { data: await res.json().catch(() => null) }
  },

  post: async (url, data = {}) => {
    const fullUrl = `${API_URL}${url}`
    const isFormData = data instanceof FormData
    const headers = {}
    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      const user = stored ? JSON.parse(stored) : null
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data)
    })
    if (res.status === 401) {
      return handleUnauthorized(res)
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    if (res.status === 204) return { data: null }
    return { data: await res.json().catch(() => null) }
  },

  put: async (url, data = {}) => {
    const fullUrl = `${API_URL}${url}`
    const isFormData = data instanceof FormData
    const headers = {}
    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      const user = stored ? JSON.parse(stored) : null
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'PUT', headers, body: isFormData ? data : JSON.stringify(data) })
    if (res.status === 401) {
      return handleUnauthorized(res)
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    if (res.status === 204) return { data: null }
    return { data: await res.json().catch(() => null) }
  },

  patch: async (url, data = {}) => {
    const fullUrl = `${API_URL}${url}`
    const isFormData = data instanceof FormData
    const headers = {}
    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      const user = stored ? JSON.parse(stored) : null
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'PATCH', headers, body: isFormData ? data : JSON.stringify(data) })
    if (res.status === 401) {
      return handleUnauthorized(res)
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    if (res.status === 204) return { data: null }
    return { data: await res.json().catch(() => ({})) }
  },

  delete: async (url, config = {}) => {
    let fullUrl = `${API_URL}${url}`
    if (config.params) {
      const queryParams = new URLSearchParams()
      Object.keys(config.params).forEach((key) => {
        if (config.params[key] !== undefined && config.params[key] !== null) {
          queryParams.append(key, config.params[key])
        }
      })
      const queryString = queryParams.toString()
      if (queryString) {
        fullUrl += `?${queryString}`
      }
    }

    const headers = { 'Content-Type': 'application/json' }
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      const user = stored ? JSON.parse(stored) : null
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'DELETE', headers })
    if (res.status === 401) {
      return handleUnauthorized(res)
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    if (res.status === 204) return { data: null }
    return { data: await res.json().catch(() => null) }
  }
}

export default apiClient
