import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export default function RoleRoute({ allowedRoles }) {
  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
  let user = null
  try {
    user = storedUser ? JSON.parse(storedUser) : null
  } catch {
    user = null
  }

  if (!user || !user.role) {
    return <Navigate to="/login" replace />
  }

  // Kiểm tra vai trò của người dùng (không phân biệt chữ hoa thường)
  const userRole = (user.role || '').trim().toLowerCase()
  const hasAccess = allowedRoles.some(r => r.trim().toLowerCase() === userRole)

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

