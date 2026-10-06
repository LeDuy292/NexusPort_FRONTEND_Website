import { useState } from 'react'

export default function useAuth() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    try {
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  /**
   * Lưu thông tin user + JWT token từ backend vào cả localStorage và sessionStorage.
   * @param {Object} userData  - { id, username, email, role, fullName, isActive }
   * @param {string} token     - JWT access token từ API
   * @param {boolean} rememberMe - Trạng thái ghi nhớ username
   */
  const loginWithToken = (userData, token, rememberMe = true) => {
    const newUser = { ...userData, token }
    localStorage.setItem('user', JSON.stringify(newUser))
    sessionStorage.setItem('user', JSON.stringify(newUser))
    if (token) {
      localStorage.setItem('token', token)
      sessionStorage.setItem('token', token)
    }
    if (rememberMe && userData.username) {
      localStorage.setItem('rememberedUsername', userData.username)
    }
    setUser(newUser)
  }

  /**
   * Mock fallback
   */
  const login = (username, role) => {
    const newUser = { username, role, token: 'mock-jwt-token-xyz' }
    localStorage.setItem('user', JSON.stringify(newUser))
    sessionStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('user')
    sessionStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
    setUser(null)
  }

  const hasRole = (roles) => {
    if (!user || !user.role) return false
    const userRole = user.role.toLowerCase()
    if (typeof roles === 'string') return userRole === roles.toLowerCase()
    return roles.map(r => r.toLowerCase()).includes(userRole)
  }

  return {
    user,
    isAuthenticated: !!user,
    role: user?.role || null,
    token: user?.token || null,
    login,
    loginWithToken,
    logout,
    hasRole,
  }
}


