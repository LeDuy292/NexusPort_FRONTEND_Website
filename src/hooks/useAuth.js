import { useState } from 'react'

export default function useAuth() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  /**
   * Lưu thông tin user + JWT token từ backend.
   * Nếu rememberMe = true -> Lưu vào localStorage (lưu trữ lâu dài).
   * Nếu rememberMe = false -> Lưu vào sessionStorage (tự xóa khi đóng tab).
   * @param {Object} userData  - { id, username, email, role, fullName, isActive }
   * @param {string} token     - JWT access token từ API
   * @param {boolean} rememberMe - Trạng thái ghi nhớ đăng nhập
   */
  const loginWithToken = (userData, token, rememberMe = false) => {
    const newUser = { ...userData, token }
    if (rememberMe) {
      localStorage.setItem('user', JSON.stringify(newUser))
      localStorage.setItem('rememberedUsername', userData.username)
      sessionStorage.removeItem('user')
    } else {
      sessionStorage.setItem('user', JSON.stringify(newUser))
      localStorage.removeItem('user')
      localStorage.removeItem('rememberedUsername')
    }
    setUser(newUser)
  }

  /**
   * Giữ signature cũ (mock fallback).
   */
  const login = (username, role) => {
    const newUser = { username, role, token: 'mock-jwt-token-xyz' }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('user')
    sessionStorage.removeItem('user')
    setUser(null)
  }

  const hasRole = (roles) => {
    if (!user) return false
    if (typeof roles === 'string') return user.role === roles
    return roles.includes(user.role)
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

