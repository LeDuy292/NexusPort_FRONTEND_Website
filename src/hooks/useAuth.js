import { useState } from 'react'

export default function useAuth() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (username, role) => {
    const newUser = { username, role, token: 'mock-jwt-token-xyz' }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('user')
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
    login,
    logout,
    hasRole
  }
}
