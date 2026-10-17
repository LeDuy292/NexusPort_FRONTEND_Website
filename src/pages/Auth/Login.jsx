import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithToken } = useAuth()

  // Kiểm tra cờ kicked từ query params
  const isKicked = new URLSearchParams(location.search).get('kicked') === 'true'

  // State form chính
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  // State lỗi validation
  const [errors, setErrors] = useState({
    username: '',
    password: '',
    general: '',
  })

  // State Quên mật khẩu Modal
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: nhập email/username -> nhận OTP, 2: nhập OTP + mật khẩu mới
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotErrors, setForgotErrors] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Điền sẵn username nếu đã tích "Ghi nhớ đăng nhập" từ trước
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername')
    if (savedUsername) {
      setUsername(savedUsername)
      setRememberMe(true)
    }
  }, [])

  const roles = [
    {
      id: 'carrier',
      title: 'Transport Company',
      desc: 'Hãng tàu / doanh nghiệp vận tải biển',
      roleName: 'Transport Company',
      icon: 'directions_boat',
      iconBg: 'rgba(99,179,237,0.12)',
      iconColor: '#63b3ed',
      redirect: '/carrier-portal'
    },
    {
      id: 'driver',
      title: 'Driver',
      desc: 'Tài xế container / vận chuyển hàng hóa',
      roleName: 'Driver',
      icon: 'local_shipping',
      iconBg: 'rgba(104,211,145,0.12)',
      iconColor: '#68d391',
      redirect: '/driver-portal'
    },
    {
      id: 'gate',
      title: 'Gate Officer',
      desc: 'Kiểm soát viên cổng vào ra',
      roleName: 'Gate Officer',
      icon: 'shield_with_heart',
      iconBg: 'rgba(72,187,120,0.12)',
      iconColor: '#48bb78',
      redirect: '/gate'
    },
    {
      id: 'operator',
      title: 'Dispatcher',
      desc: 'Điều phối viên vận hành cảng',
      roleName: 'Dispatcher',
      icon: 'settings_suggest',
      iconBg: 'rgba(255,104,44,0.15)',
      iconColor: '#ff682c',
      redirect: '/dashboard'
    },
    {
      id: 'yard',
      title: 'Yard Operator',
      desc: 'Nhân viên vận hành bãi container',
      roleName: 'Yard Operator',
      icon: 'forklift',
      iconBg: 'rgba(246,173,85,0.12)',
      iconColor: '#f6ad55',
      redirect: '/yard-staff/dashboard'
    },
    {
      id: 'berth',
      title: 'Berth Staff',
      desc: 'Nhân viên vận hành cầu tàu / bến cảng',
      roleName: 'Berth Staff',
      icon: 'anchor',
      iconBg: 'rgba(118,169,250,0.12)',
      iconColor: '#76a9fa',
      redirect: '/berth-staff/dashboard'
    },
    {
      id: 'admin',
      title: 'Administrator',
      desc: 'Quản trị viên hệ thống',
      roleName: 'Administrator',
      icon: 'admin_panel_settings',
      iconBg: 'rgba(159,122,234,0.12)',
      iconColor: '#9f7aea',
      redirect: '/admin/carriers'
    }
  ]

  const showToastMessage = (msg, icon = 'check_circle', type = 'success') => {
    setToast({ msg, icon, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSelectRole = (roleObj) => {
    setSelectedRole(roleObj)
    setErrors({ username: '', password: '', general: '' })
    setTimeout(() => {
      setStep(2)
    }, 150)
  }

  // Validate form đăng nhập phía client
  const validateLoginForm = () => {
    const newErrors = { username: '', password: '', general: '' }
    let isValid = true

    const trimmedUser = username.trim()
    if (!trimmedUser) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập hoặc email.'
      isValid = false
    } else if (trimmedUser.length < 3) {
      newErrors.username = 'Tên đăng nhập hoặc email phải có ít nhất 3 ký tự.'
      isValid = false
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu.'
      isValid = false
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!validateLoginForm()) {
      showToastMessage('Vui lòng kiểm tra lại thông tin nhập!', 'warning', 'error')
      return
    }

    setLoading(true)
    setErrors({ username: '', password: '', general: '' })

    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api'
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          rememberMe,
          expectedRole: selectedRole?.roleName || undefined,
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setLoading(false)
        const fieldErrs = {
          username: '',
          password: '',
          general: result.message || 'Đăng nhập không thành công.',
        }
        if (result.errors && Array.isArray(result.errors)) {
          result.errors.forEach((err) => {
            if (err.field === 'username') fieldErrs.username = err.message
            if (err.field === 'password') fieldErrs.password = err.message
          })
        }
        setErrors(fieldErrs)
        showToastMessage(result.message || 'Đăng nhập thất bại!', 'error', 'error')
        return
      }

      const { token, user } = result.data
      showToastMessage(`Chào mừng ${user.fullName || user.username}! Đang chuyển hướng...`, 'check_circle', 'success')
      
      const authUser = { ...user, token }
      localStorage.setItem('user', JSON.stringify(authUser))
      sessionStorage.setItem('user', JSON.stringify(authUser))
      if (token) {
        localStorage.setItem('token', token)
        sessionStorage.setItem('token', token)
      }
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', user.username)
      } else {
        localStorage.removeItem('rememberedUsername')
      }
      if (loginWithToken) {
        loginWithToken(user, token, rememberMe)
      }

      // Xác định đường dẫn điều hướng chính xác theo vai trò từ Backend
      const normalizedRole = (user.role || '').trim().toLowerCase()
      let redirectPath = '/dashboard'
      if (normalizedRole === 'yard operator' || normalizedRole === 'yard staff' || normalizedRole === 'yard') {
        redirectPath = '/yard-staff/dashboard'
      } else if (normalizedRole === 'dispatcher' || normalizedRole === 'operator') {
        redirectPath = '/dashboard'
      } else if (normalizedRole === 'gate officer' || normalizedRole === 'gate') {
        redirectPath = '/gate'
      } else if (normalizedRole === 'berth staff' || normalizedRole === 'berth') {
        redirectPath = '/berth-staff/dashboard'
      } else if (normalizedRole === 'transport company' || normalizedRole === 'carrier' || normalizedRole === 'carrier staff') {
        redirectPath = '/carrier-portal'
      } else if (normalizedRole === 'driver') {
        redirectPath = '/driver-portal'
      } else if (normalizedRole === 'administrator' || normalizedRole === 'admin') {
        redirectPath = '/dashboard'
      }

      setTimeout(() => {
        setLoading(false)
        navigate(redirectPath, { replace: true })
      }, 350)

    } catch (err) {
      console.error('Login error:', err)
      setErrors((prev) => ({ ...prev, general: 'Không thể kết nối đến máy chủ backend!' }))
      showToastMessage('Không thể kết nối đến máy chủ backend!', 'error', 'error')
      setLoading(false)
    }
  }

  // Xử lý gửi yêu cầu OTP quên mật khẩu
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault()
    if (!forgotEmail.trim()) {
      setForgotErrors((prev) => ({ ...prev, email: 'Vui lòng nhập Email hoặc Tên đăng nhập.' }))
      return
    }

    setForgotErrors({ email: '', otp: '', newPassword: '', confirmPassword: '' })
    setForgotLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setForgotErrors((prev) => ({ ...prev, email: data.message || 'Yêu cầu thất bại!' }))
        showToastMessage(data.message || 'Yêu cầu thất bại!', 'error', 'error')
        setForgotLoading(false)
        return
      }

      setGeneratedOtp(data.data.otp)
      showToastMessage(`Mã OTP đã khởi tạo: ${data.data.otp}`, 'check_circle', 'success')
      setForgotStep(2)
      setForgotLoading(false)
    } catch (err) {
      console.error(err)
      showToastMessage('Không thể kết nối máy chủ!', 'error', 'error')
      setForgotLoading(false)
    }
  }

  // Xử lý xác nhận OTP và đặt lại mật khẩu mới
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault()
    const errs = { email: '', otp: '', newPassword: '', confirmPassword: '' }
    let valid = true

    if (!forgotOtp.trim()) {
      errs.otp = 'Vui lòng nhập mã xác thực OTP.'
      valid = false
    } else if (forgotOtp.trim().length !== 6) {
      errs.otp = 'Mã OTP bao gồm chính xác 6 chữ số.'
      valid = false
    }

    if (!newPassword.trim()) {
      errs.newPassword = 'Vui lòng nhập mật khẩu mới.'
      valid = false
    } else if (newPassword.trim().length < 6) {
      errs.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự.'
      valid = false
    }

    if (!confirmPassword.trim()) {
      errs.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.'
      valid = false
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Mật khẩu xác nhận không khớp!'
      valid = false
    }

    setForgotErrors(errs)
    if (!valid) return

    setForgotLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
          newPassword: newPassword.trim()
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        showToastMessage(data.message || 'Đặt lại mật khẩu thất bại!', 'error', 'error')
        setForgotLoading(false)
        return
      }

      showToastMessage('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập.', 'check_circle', 'success')
      setUsername(forgotEmail)
      setPassword(newPassword)
      setShowForgotModal(false)
      setForgotLoading(false)
    } catch (err) {
      console.error(err)
      showToastMessage('Không thể kết nối máy chủ!', 'error', 'error')
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-[#080808] text-white font-sans selection:bg-[#ff682c] selection:text-white">
      {/* Background layers */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`
        }}
      />
      
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,104,44,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,104,44,0.04) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#ff682c] rounded-full blur-[100px] opacity-15 pointer-events-none animate-pulse" />
      <div className="absolute top-[50%] right-[-8%] w-[400px] h-[400px] bg-[#ff9f6b] rounded-full blur-[100px] opacity-15 pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[30%] w-[300px] h-[300px] bg-[#ffcca3] rounded-full blur-[100px] opacity-10 pointer-events-none" />

      {/* Port Silhouette SVG */}
      <div className="absolute bottom-0 left-0 right-0 opacity-[0.035] pointer-events-none select-none">
        <svg viewBox="0 0 1440 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full">
          <path d="M0,200 L0,140 L40,140 L40,80 L50,80 L50,60 L60,60 L60,80 L70,80 L70,140 L120,140 L120,100 L140,100 L140,60 L160,60 L160,40 L170,40 L170,60 L190,60 L190,100 L210,100 L210,140 L280,140 L280,120 L300,120 L300,100 L320,100 L320,80 L330,80 L330,60 L340,60 L340,80 L350,80 L350,100 L370,100 L370,120 L390,120 L390,140 L500,140 L500,120 L510,120 L510,40 L515,40 L515,30 L520,30 L520,40 L525,40 L525,120 L560,120 L560,140 L650,140 L650,100 L680,100 L680,80 L700,80 L700,60 L710,60 L710,40 L720,40 L720,60 L730,60 L730,80 L750,80 L750,100 L780,100 L780,140 L900,140 L900,160 L1000,160 L1000,130 L1010,130 L1010,100 L1020,100 L1020,80 L1030,80 L1030,60 L1040,60 L1040,80 L1050,80 L1050,100 L1060,100 L1060,130 L1070,130 L1070,160 L1200,160 L1200,140 L1250,140 L1250,80 L1260,80 L1260,50 L1270,50 L1270,80 L1280,80 L1280,140 L1440,140 L1440,200 Z" fill="#ff682c"/>
        </svg>
      </div>

      {/* Main Container */}
      <div className="relative z-10 min-h-screen flex">
        
        {/* LEFT BRANDING */}
        <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#ff682c] rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[20px]">anchor</span>
              </div>
              <h1 className="text-[26px] font-bold tracking-tight text-white font-[#Space_Grotesk]">
                NexusPort<span className="text-[#ff682c]">.</span>
              </h1>
            </div>
            <p className="mt-4 text-[13px] text-white/40 font-medium uppercase tracking-[0.12em]">
              Terminal Management System
            </p>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ff682c]/25 bg-[#ff682c]/10 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff682c] animate-ping inline-block flex-shrink-0" />
              <span className="text-[11px] text-[#ff682c] font-semibold tracking-wide uppercase">Hệ thống đang hoạt động</span>
            </div>

            <h2 className="text-[52px] leading-[1.05] tracking-[-1.5px] font-bold text-white">
              Quản lý<br/>
              cảng biển<br/>
              <span className="text-[#ff682c]">thông minh.</span>
            </h2>

            <p className="mt-6 text-[15px] text-white/45 leading-relaxed max-w-[320px]">
              Nền tảng điều phối vận hành cảng container tích hợp AI — từ cổng kiểm soát đến quản lý bãi và thanh toán tự động.
            </p>
          </div>

          <div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-4">
                <div className="text-[24px] font-bold text-white tracking-[-0.5px]">12k+</div>
                <div className="text-[11px] text-white/35 mt-0.5 font-medium">Container/ngày</div>
              </div>
              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-4">
                <div className="text-[24px] font-bold text-white tracking-[-0.5px]">99.8%</div>
                <div className="text-[11px] text-white/35 mt-0.5 font-medium">Độ chính xác AI</div>
              </div>
              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-4">
                <div className="text-[24px] font-bold text-white tracking-[-0.5px]">24/7</div>
                <div className="text-[11px] text-white/35 mt-0.5 font-medium">Vận hành liên tục</div>
              </div>
            </div>
            <div className="mt-8 text-[12px] text-white/25">
              © 2026 NexusPort. Cảng Tiên Sa, Đà Nẵng, Việt Nam.
            </div>
          </div>
        </div>

        {/* RIGHT CARD CONTAINER */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[440px]">
            
            {/* Mobile Header */}
            <div className="flex items-center gap-2 mb-10 lg:hidden">
              <div className="w-8 h-8 bg-[#ff682c] rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]">anchor</span>
              </div>
              <span className="text-[22px] font-bold tracking-tight text-white">NexusPort<span className="text-[#ff682c]">.</span></span>
            </div>

            {/* Glass Card */}
            <div className="bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-2xl p-8 shadow-2xl transition-all">
              
              {/* Banner cảnh báo nếu phiên bị kick */}
              {isKicked && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 animate-fadeIn">
                  <span className="material-symbols-outlined text-amber-400 text-xl flex-shrink-0 mt-0.5">warning</span>
                  <div className="flex-1">
                    <div className="font-bold text-amber-200 text-[13px]">Phiên đăng nhập đã kết thúc</div>
                    <div className="text-amber-300/80 mt-1 leading-relaxed">
                      Tài khoản của bạn vừa được đăng nhập trên một thiết bị hoặc trình duyệt khác. Để bảo vệ an toàn tài khoản, phiên làm việc trước đó đã tự động đăng xuất.
                    </div>
                  </div>
                </div>
              )}

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => step === 2 && setStep(1)}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 1 ? 'bg-[#ff682c] text-white' : 'bg-white/10 text-white/40'}`}>
                    {step === 1 ? '1' : <span className="material-symbols-outlined text-[14px]">check</span>}
                  </div>
                  <span className={`text-[12px] font-semibold ${step === 1 ? 'text-[#ff682c]' : 'text-white/40'}`}>
                    Chọn vai trò
                  </span>
                </div>
                <div className="flex-1 h-px bg-white/10 mx-2" />
                <div className={`flex items-center gap-2 ${step === 2 ? '' : 'opacity-35'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 2 ? 'bg-[#ff682c] text-white' : 'border border-white/25 text-white/60'}`}>
                    2
                  </div>
                  <span className={`text-[12px] font-semibold ${step === 2 ? 'text-[#ff682c]' : 'text-white/50'}`}>
                    Xác thực
                  </span>
                </div>
              </div>

              {/* STEP 1: CHỌN VAI TRÒ */}
              {step === 1 && (
                <div className="animate-fadeIn">
                  <div className="mb-6">
                    <h2 className="text-white font-bold text-[22px] tracking-[-0.3px]">Xin chào!</h2>
                    <p className="text-white/40 text-[13px] mt-1.5 font-medium">Chọn vai trò của bạn để tiếp tục đăng nhập</p>
                  </div>

                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {roles.map((r) => {
                      const isSelected = selectedRole?.id === r.id
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleSelectRole(r)}
                          className={`relative bg-white/[0.04] border rounded-xl p-4 cursor-pointer transition-all duration-200 overflow-hidden hover:-translate-y-0.5 hover:shadow-lg ${
                            isSelected
                              ? 'border-[#ff682c] bg-[#ff682c]/10 shadow-[0_0_0_1px_rgba(255,104,44,0.3)]'
                              : 'border-white/10 hover:border-[#ff682c]/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 relative z-10">
                            <div 
                              className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: r.iconBg }}
                            >
                              <span className="material-symbols-outlined text-[20px]" style={{ color: r.iconColor }}>
                                {r.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-[13px] font-semibold leading-tight">{r.title}</div>
                              <div className="text-white/40 text-[11px] mt-0.5">{r.desc}</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-[#ff682c] border-[#ff682c]' : 'border-white/25'}`}>
                              {isSelected && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-center text-white/20 text-[11px] mt-4 font-medium">Nhấn vào vai trò để tiếp tục</p>
                </div>
              )}

              {/* STEP 2: NHẬP THÔNG TIN TÀI KHOẢN VÀ MẬT KHẨU */}
              {step === 2 && (
                <div className="animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1)
                        setErrors({ username: '', password: '', general: '' })
                      }}
                      className="w-8 h-8 rounded-full border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:border-white/25 transition-all"
                      title="Chọn lại vai trò"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ff682c]/30 bg-[#ff682c]/10">
                      <span className="material-symbols-outlined text-[#ff682c] text-[14px]">
                        {selectedRole?.icon || 'person'}
                      </span>
                      <span className="text-[#ff682c] text-[12px] font-semibold">
                        {selectedRole?.title}
                      </span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-white font-bold text-[22px] tracking-[-0.3px]">Đăng nhập</h2>
                    <p className="text-white/40 text-[13px] mt-1.5 font-medium">Nhập thông tin xác thực của bạn</p>
                  </div>

                  {/* Lỗi tổng quát (Role mismatch / Account disabled / Connection) */}
                  {errors.general && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 mb-5 font-medium leading-relaxed animate-fadeIn">
                      <span className="material-symbols-outlined text-red-400 text-base flex-shrink-0 mt-0.5">error</span>
                      <span>{errors.general}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {/* TRƯỜNG USERNAME / EMAIL */}
                    <div>
                      <label className="block text-[12px] font-semibold text-white/45 uppercase tracking-[0.08em] mb-2">
                        Tên đăng nhập / Email <span className="text-[#ff682c]">*</span>
                      </label>
                      <div className="relative">
                        <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] transition-colors ${errors.username ? 'text-red-400' : 'text-white/25'}`}>
                          person
                        </span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value)
                            if (errors.username) setErrors((prev) => ({ ...prev, username: '' }))
                            if (errors.general) setErrors((prev) => ({ ...prev, general: '' }))
                          }}
                          placeholder="nguyen.van.a@nexusport.vn"
                          className={`w-full rounded-lg py-3 pl-11 pr-4 text-white text-[14px] font-medium outline-none transition-all placeholder:text-white/30 ${
                            errors.username
                              ? 'bg-red-500/[0.06] border border-red-500/70 focus:border-red-400 focus:ring-2 focus:ring-red-500/20'
                              : 'bg-white/5 border border-white/12 focus:border-[#ff682c]/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#ff682c]/10'
                          }`}
                        />
                      </div>
                      {errors.username && (
                        <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1 font-medium animate-fadeIn">
                          <span className="material-symbols-outlined text-[14px]">error</span>
                          {errors.username}
                        </p>
                      )}
                    </div>

                    {/* TRƯỜNG PASSWORD */}
                    <div>
                      <label className="block text-[12px] font-semibold text-white/45 uppercase tracking-[0.08em] mb-2">
                        Mật khẩu <span className="text-[#ff682c]">*</span>
                      </label>
                      <div className="relative">
                        <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] transition-colors ${errors.password ? 'text-red-400' : 'text-white/25'}`}>
                          lock
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
                            if (errors.general) setErrors((prev) => ({ ...prev, general: '' }))
                          }}
                          placeholder="••••••••••••"
                          className={`w-full rounded-lg py-3 pl-11 pr-11 text-white text-[14px] font-medium outline-none transition-all placeholder:text-white/30 ${
                            errors.password
                              ? 'bg-red-500/[0.06] border border-red-500/70 focus:border-red-400 focus:ring-2 focus:ring-red-500/20'
                              : 'bg-white/5 border border-white/12 focus:border-[#ff682c]/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#ff682c]/10'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                          tabIndex={-1}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1 font-medium animate-fadeIn">
                          <span className="material-symbols-outlined text-[14px]">error</span>
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                        <div
                          onClick={() => setRememberMe(!rememberMe)}
                          className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                            rememberMe ? 'bg-[#ff682c] border-[#ff682c]' : 'border-white/20 group-hover:border-[#ff682c]/50'
                          }`}
                        >
                          {rememberMe && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                        </div>
                        <span className="text-white/40 text-[13px] font-medium">Ghi nhớ đăng nhập</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(username)
                          setForgotStep(1)
                          setForgotErrors({ email: '', otp: '', newPassword: '', confirmPassword: '' })
                          setShowForgotModal(true)
                        }}
                        className="text-[#ff682c] text-[13px] font-semibold hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#ff682c] hover:bg-[#e05520] text-white font-semibold text-[14px] py-3.5 px-6 rounded-lg transition-all shadow-lg hover:shadow-[#ff682c]/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" opacity="0.4"/>
                              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3"/>
                            </svg>
                            Đang xác thực...
                          </span>
                        ) : (
                          'Đăng nhập vào hệ thống'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>

          </div>
        </div>

      </div>

      {/* MODAL QUÊN MẬT KHẨU */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-[440px] bg-[#121212] border border-white/15 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#ff682c]/15 border border-[#ff682c]/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ff682c] text-[22px]">lock_reset</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-[18px]">Khôi phục mật khẩu</h3>
                <p className="text-white/40 text-[12px]">
                  {forgotStep === 1 ? 'Bước 1: Nhập Email hoặc Tên đăng nhập' : 'Bước 2: Xác thực mã OTP & Đổi mật khẩu'}
                </p>
              </div>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp} className="space-y-4 mt-4" noValidate>
                <div>
                  <label className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-2">
                    Email / Tên đăng nhập <span className="text-[#ff682c]">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[18px]">mail</span>
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value)
                        if (forgotErrors.email) setForgotErrors((prev) => ({ ...prev, email: '' }))
                      }}
                      placeholder="admin hoặc admin@nexusport.vn"
                      className={`w-full rounded-lg py-2.5 pl-10 pr-4 text-white text-[13px] outline-none transition-all ${
                        forgotErrors.email
                          ? 'bg-red-500/[0.06] border border-red-500/70 focus:border-red-400'
                          : 'bg-white/5 border border-white/12 focus:border-[#ff682c]'
                      }`}
                    />
                  </div>
                  {forgotErrors.email && (
                    <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[13px]">error</span>
                      {forgotErrors.email}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 text-white/60 text-[13px] font-semibold transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-[#ff682c] hover:bg-[#e05520] text-white rounded-lg py-2.5 text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? 'Đang xử lý...' : 'Gửi mã OTP'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3.5 mt-4" noValidate>
                {generatedOtp && (
                  <div className="bg-[#ff682c]/10 border border-[#ff682c]/30 rounded-lg p-3 text-[12px] text-[#ff682c] font-medium flex items-center justify-between">
                    <span>Mã OTP thử nghiệm: <strong>{generatedOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOtp(generatedOtp)
                        if (forgotErrors.otp) setForgotErrors((prev) => ({ ...prev, otp: '' }))
                      }}
                      className="text-[11px] underline font-semibold hover:text-white"
                    >
                      Tự điền
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">
                    Mã OTP (6 chữ số) <span className="text-[#ff682c]">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => {
                      setForgotOtp(e.target.value)
                      if (forgotErrors.otp) setForgotErrors((prev) => ({ ...prev, otp: '' }))
                    }}
                    placeholder="123456"
                    className={`w-full rounded-lg py-2 pl-3 text-white text-[14px] font-mono tracking-widest outline-none ${
                      forgotErrors.otp
                        ? 'bg-red-500/[0.06] border border-red-500/70 focus:border-red-400'
                        : 'bg-white/5 border border-white/12 focus:border-[#ff682c]'
                    }`}
                  />
                  {forgotErrors.otp && (
                    <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[13px]">error</span>
                      {forgotErrors.otp}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">
                    Mật khẩu mới (tối thiểu 6 ký tự) <span className="text-[#ff682c]">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      if (forgotErrors.newPassword) setForgotErrors((prev) => ({ ...prev, newPassword: '' }))
                    }}
                    placeholder="Nhập mật khẩu mới"
                    className={`w-full rounded-lg py-2 pl-3 text-white text-[13px] outline-none ${
                      forgotErrors.newPassword
                        ? 'bg-red-500/[0.06] border border-red-500/70 focus:border-red-400'
                        : 'bg-white/5 border border-white/12 focus:border-[#ff682c]'
                    }`}
                  />
                  {forgotErrors.newPassword && (
                    <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[13px]">error</span>
                      {forgotErrors.newPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">
                    Xác nhận mật khẩu mới <span className="text-[#ff682c]">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (forgotErrors.confirmPassword) setForgotErrors((prev) => ({ ...prev, confirmPassword: '' }))
                    }}
                    placeholder="Nhập lại mật khẩu mới"
                    className={`w-full rounded-lg py-2 pl-3 text-white text-[13px] outline-none ${
                      forgotErrors.confirmPassword
                        ? 'bg-red-500/[0.06] border border-red-500/70 focus:border-red-400'
                        : 'bg-white/5 border border-white/12 focus:border-[#ff682c]'
                    }`}
                  />
                  {forgotErrors.confirmPassword && (
                    <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[13px]">error</span>
                      {forgotErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white/60 text-[13px] font-semibold transition-all"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-[#ff682c] hover:bg-[#e05520] text-white rounded-lg py-2.5 text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? 'Đang đổi...' : 'Xác nhận đổi mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border border-white/10 bg-black/80 backdrop-blur-md text-white text-[13px] font-semibold shadow-2xl animate-bounce">
          <span className="material-symbols-outlined text-[18px]" style={{ color: toast.type === 'success' ? '#48bb78' : '#ff682c' }}>
            {toast.icon}
          </span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}
