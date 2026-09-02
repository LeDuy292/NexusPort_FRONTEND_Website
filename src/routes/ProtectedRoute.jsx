import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null

  // Nếu chưa đăng nhập, chuyển hướng sang trang login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Nếu đã đăng nhập, render các route con bên trong
  return <Outlet />
}
