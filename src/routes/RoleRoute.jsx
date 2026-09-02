import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export default function RoleRoute({ allowedRoles }) {
  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Kiểm tra vai trò của người dùng có nằm trong danh sách được phép không
  const hasAccess = allowedRoles.includes(user.role)

  if (!hasAccess) {
    // Nếu không có quyền, chuyển hướng về trang báo lỗi
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
