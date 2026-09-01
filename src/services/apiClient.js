// Lấy API base URL từ biến môi trường, mặc định là http://localhost:5000/api
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

    const headers = { 'Content-Type': 'application/json' }
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'GET', headers })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    return { data: await res.json() }
  },

  post: async (url, data = {}) => {
    const fullUrl = `${API_URL}${url}`
    const headers = { 'Content-Type': 'application/json' }
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'POST', headers, body: JSON.stringify(data) })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    return { data: await res.json() }
  },

  put: async (url, data = {}) => {
    const fullUrl = `${API_URL}${url}`
    const headers = { 'Content-Type': 'application/json' }
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`
      }
    } catch (e) {}

    const res = await fetch(fullUrl, { method: 'PUT', headers, body: JSON.stringify(data) })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const err = new Error(errorData.message || `HTTP error ${res.status}`)
      err.response = { status: res.status, data: errorData }
      throw err
    }
    return { data: await res.json() }
  }
}

export default apiClient
