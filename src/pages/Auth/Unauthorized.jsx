import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Unauthorized() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user'))

  const handleLogout = () => {
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6 bg-paper p-8 rounded-[12px] border border-chalk shadow-sm text-center">
        <div className="text-red-600 text-6xl mb-2">⚠️</div>
        <h2 className="text-2xl font-extrabold text-carbon tracking-tight font-heading">
          Không có quyền truy cập
        </h2>
        <p className="text-sm text-slate">
          Tài khoản với vai trò <strong className="text-carbon">"{user?.role || 'Khách'}"</strong> không có quyền truy cập trang web quản trị này.
        </p>
        {user?.role === 'Driver' && (
          <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200">
            Tài xế vui lòng sử dụng ứng dụng di động NexusPort Driver để nhận lịch trình và vận chuyển.
          </p>
        )}
        <div className="pt-4 flex gap-4 justify-center">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-carbon text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Đăng xuất & Đăng nhập lại
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-chalk text-xs font-bold rounded-lg hover:bg-fog transition-colors"
          >
            Quay lại Trang chủ
          </button>
        </div>
      </div>
    </div>
  )
}
