import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Administrator')

  const handleLogin = (e) => {
    e.preventDefault()
    // Simulated Login
    localStorage.setItem('user', JSON.stringify({ username, role }))
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-paper p-8 rounded-[12px] border border-chalk shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-carbon tracking-tight font-heading">
            NexusPort<span className="text-signal-orange">.</span>
          </h2>
          <p className="mt-2 text-center text-sm text-slate">
            Hệ thống Quản lý Cổng Cảng và Container Thông Minh
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate uppercase mb-1">Tài khoản</label>
              <input
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-chalk placeholder-slate-400 text-carbon focus:outline-none focus:ring-signal focus:border-signal sm:text-sm"
                placeholder="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate uppercase mb-1">Mật khẩu</label>
              <input
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-chalk placeholder-slate-400 text-carbon focus:outline-none focus:ring-signal focus:border-signal sm:text-sm"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate uppercase mb-1">Vai trò (Role)</label>
              <select
                className="block w-full px-3 py-2 border border-chalk bg-white rounded-md shadow-sm focus:outline-none focus:ring-signal focus:border-signal sm:text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Transport Company">Transport Company</option>
                <option value="Driver">Driver</option>
                <option value="Gate Officer">Gate Officer</option>
                <option value="Dispatcher">Dispatcher</option>
                <option value="Yard Operator">Yard Operator</option>
                <option value="Berth Staff">Berth Staff</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-[#202020] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-signal transition-opacity"
            >
              Đăng nhập
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
