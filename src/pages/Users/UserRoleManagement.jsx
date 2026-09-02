import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  getUsers,
  createUser,
  updateUser,
  assignRole,
  activateUser,
  deactivateUser,
} from '../../services/userService'

// ─── Constants ────────────────────────────────────────────────────────────────
const VALID_ROLES = [
  'Administrator',
  'Transport Company',
  'Driver',
  'Dispatcher',
  'Gate Officer',
  'Yard Operator',
  'Berth Staff',
]

const ROLE_COLORS = {
  'Administrator':     'bg-purple-100 text-purple-800 border-purple-200',
  'Dispatcher':        'bg-blue-100 text-blue-800 border-blue-200',
  'Gate Officer':      'bg-green-100 text-green-800 border-green-200',
  'Yard Operator':     'bg-orange-100 text-orange-800 border-orange-200',
  'Berth Staff':       'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Transport Company': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Driver':            'bg-red-100 text-red-800 border-red-200',
}

const ROLE_DESCS = {
  'Administrator':     'Quyền quản trị cao nhất toàn bộ hệ thống cảng',
  'Dispatcher':        'Quản lý điều độ phương tiện & theo dõi tàu biển',
  'Gate Officer':      'Nhận diện OCR AI & phê duyệt xe ra vào cổng',
  'Yard Operator':     'Quản lý sơ đồ xếp chồng container & điều phối thiết bị bãi',
  'Berth Staff':       'Vận hành cầu tàu & kiểm soát lịch cập bến',
  'Transport Company': 'Doanh nghiệp vận tải & Hãng tàu đăng ký booking',
  'Driver':            'Tài xế container thực hiện chuyến hàng',
}

function getInitials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().substring(0, 2)
}

// ─── Toast Component ──────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    success: 'bg-emerald-600 border-emerald-500',
    error:   'bg-red-600 border-red-500',
    info:    'bg-blue-600 border-blue-500',
  }

  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-white text-sm font-semibold animate-[slideInRight_0.3s_ease] ${colors[type] || colors.info}`}>
      <span className="material-symbols-outlined text-[20px]">
        {type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
      </span>
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Xác nhận', confirmClass = 'bg-red-600 hover:bg-red-700' }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[28px] mt-0.5">warning</span>
          <div>
            <h3 className="font-bold text-carbon text-base">{title}</h3>
            <p className="text-slate text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-full border border-chalk text-slate text-sm font-semibold hover:bg-fog"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-full text-white text-sm font-bold transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── User Drawer (Create / Edit) ──────────────────────────────────────────────
function UserDrawer({ mode, user, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState({
    username:  user?.username  || '',
    email:     user?.email     || '',
    password:  '',
    role:      user?.role      || 'Dispatcher',
    fullName:  user?.fullName  || '',
    isActive:  user?.isActive  !== undefined ? user.isActive : true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let result
      if (isEdit) {
        result = await updateUser(user.id, {
          username: form.username,
          email:    form.email,
          fullName: form.fullName,
        })
      } else {
        result = await createUser({
          username: form.username,
          email:    form.email,
          password: form.password,
          role:     form.role,
          fullName: form.fullName,
          isActive: form.isActive,
        })
      }
      onSaved(result.data.user, isEdit ? 'Cập nhật thông tin thành công.' : 'Tạo tài khoản thành công.')
    } catch (err) {
      setError(err.response?.data?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-carbon/60 backdrop-blur-sm z-[80] flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-y-auto animate-[slideInRight_0.3s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-chalk sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-carbon text-xl">
              {isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm người dùng mới'}
            </h3>
            <p className="text-slate text-xs mt-0.5">
              {isEdit ? `ID: ${user.id}` : 'Điền đầy đủ thông tin tài khoản'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-fog text-slate hover:text-carbon transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 px-7 py-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate uppercase tracking-wide">
              Tên đăng nhập <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.username}
              onChange={set('username')}
              placeholder="vd: yard_operator_02"
              className="w-full h-10 px-3.5 border border-chalk rounded-lg text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange/40 focus:border-signal-orange transition-colors"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate uppercase tracking-wide">
              Họ và Tên
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="Nguyễn Văn A"
              className="w-full h-10 px-3.5 border border-chalk rounded-lg text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange/40 focus:border-signal-orange transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate uppercase tracking-wide">
              Địa chỉ Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="user@nexusport.vn"
              className="w-full h-10 px-3.5 border border-chalk rounded-lg text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange/40 focus:border-signal-orange transition-colors"
            />
          </div>

          {/* Password — only for create */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate uppercase tracking-wide">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={set('password')}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full h-10 px-3.5 border border-chalk rounded-lg text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange/40 focus:border-signal-orange transition-colors"
              />
            </div>
          )}

          {/* Role — only for create */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate uppercase tracking-wide">
                Vai trò (Role) <span className="text-red-500">*</span>
              </label>
              <select
                value={form.role}
                onChange={set('role')}
                className="w-full h-10 px-3.5 border border-chalk rounded-lg text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange/40 focus:border-signal-orange transition-colors bg-white"
              >
                {VALID_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {/* isActive toggle — only for create */}
          {!isEdit && (
            <div className="flex items-center justify-between p-4 bg-fog rounded-xl border border-chalk">
              <div>
                <div className="text-sm font-bold text-carbon">Kích hoạt ngay</div>
                <div className="text-xs text-slate">Cho phép đăng nhập ngay sau khi tạo</div>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-chalk flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-full border border-chalk text-slate text-sm font-semibold hover:bg-fog transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="h-10 px-6 bg-carbon text-white rounded-full text-sm font-bold hover:bg-black transition-colors shadow disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Role Modal ────────────────────────────────────────────────────────
function AssignRoleModal({ user, onClose, onSaved }) {
  const [selectedRole, setSelectedRole] = useState(user.role)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async () => {
    if (selectedRole === user.role) { onClose(); return }
    setLoading(true)
    setError('')
    try {
      const result = await assignRole(user.id, selectedRole)
      onSaved(result.data.user, `Đã gán role "${selectedRole}" thành công.`)
    } catch (err) {
      setError(err.response?.data?.message || 'Đã có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-carbon text-lg">Gán vai trò</h3>
            <p className="text-slate text-xs mt-0.5">{user.fullName || user.username}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-fog rounded-full text-slate hover:text-carbon">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}

        <div className="space-y-2">
          {VALID_ROLES.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selectedRole === role
                  ? 'border-signal-orange bg-orange-50'
                  : 'border-chalk hover:border-slate/40 hover:bg-fog'
              }`}
            >
              <span className={`flex-1 text-sm font-semibold ${selectedRole === role ? 'text-carbon' : 'text-graphite'}`}>
                {role}
              </span>
              {selectedRole === role && (
                <span className="material-symbols-outlined text-signal-orange text-[18px]">check_circle</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2 rounded-full border border-chalk text-slate text-sm font-semibold hover:bg-fog">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-carbon text-white rounded-full text-sm font-bold hover:bg-black disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5,6].map(i => (
        <td key={i} className="py-4 px-4">
          <div className="h-4 bg-chalk rounded animate-pulse" style={{ width: `${60 + i * 5}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserRoleManagement() {
  const [users,        setUsers]        = useState([])
  const [total,        setTotal]        = useState(0)
  const [totalPages,   setTotalPages]   = useState(1)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('users')

  // Filters
  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // UI state
  const [drawer,       setDrawer]       = useState(null) // null | { mode: 'create'|'edit', user? }
  const [roleModal,    setRoleModal]    = useState(null) // null | user
  const [confirm,      setConfirm]      = useState(null) // null | { type, user }
  const [toast,        setToast]        = useState(null) // null | { message, type }

  // Debounced search
  const searchRef = useRef(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const fetchUsers = useCallback(async (opts = {}) => {
    setLoading(true)
    try {
      const params = {
        search:   opts.search  !== undefined ? opts.search  : search,
        role:     opts.role    !== undefined ? opts.role    : roleFilter,
        status:   opts.status  !== undefined ? opts.status  : statusFilter,
        page:     opts.page    !== undefined ? opts.page    : page,
        limit:    20,
      }
      // Clean empty params
      Object.keys(params).forEach(k => { if (!params[k] || params[k] === 'all') delete params[k] })

      const res = await getUsers(params)
      setUsers(res.data.users)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch {
      showToast('Không thể tải danh sách người dùng.', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, statusFilter, page, showToast])

  // Initial load
  useEffect(() => { fetchUsers() }, []) // eslint-disable-line

  // Refetch khi filter/page thay đổi (không chạy lần đầu)
  const isMounted = useRef(false)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    fetchUsers({ page })
  }, [page]) // eslint-disable-line

  // Debounce search
  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setPage(1)
      fetchUsers({ search: val, page: 1 })
    }, 400)
  }

  const handleFilterChange = (type, value) => {
    if (type === 'role')   { setRoleFilter(value);   fetchUsers({ role: value,   page: 1 }); setPage(1) }
    if (type === 'status') { setStatusFilter(value); fetchUsers({ status: value, page: 1 }); setPage(1) }
  }

  // ── Handlers ──
  const handleUserSaved = (savedUser, message) => {
    setDrawer(null)
    showToast(message)
    fetchUsers()
  }

  const handleRoleSaved = (savedUser, message) => {
    setRoleModal(null)
    showToast(message)
    fetchUsers()
  }

  const handleToggleActive = (user) => {
    if (user.isActive) {
      setConfirm({ type: 'deactivate', user })
    } else {
      setConfirm({ type: 'activate', user })
    }
  }

  const handleConfirm = async () => {
    const { type, user } = confirm
    setConfirm(null)
    try {
      if (type === 'activate') {
        await activateUser(user.id)
        showToast(`Đã kích hoạt tài khoản "${user.username}".`)
      } else {
        await deactivateUser(user.id)
        showToast(`Đã vô hiệu hóa tài khoản "${user.username}".`, 'info')
      }
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.message || 'Đã có lỗi xảy ra.', 'error')
    }
  }

  // ── Role stats for "Roles" tab ──
  const roleCounts = VALID_ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length
    return acc
  }, {})

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 min-h-screen bg-fog/30">

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          title={confirm.type === 'deactivate' ? 'Vô hiệu hóa tài khoản?' : 'Kích hoạt tài khoản?'}
          message={
            confirm.type === 'deactivate'
              ? `Tài khoản "${confirm.user.username}" sẽ bị khóa và không thể đăng nhập. Bạn có chắc chắn?`
              : `Tài khoản "${confirm.user.username}" sẽ được kích hoạt trở lại. Bạn có chắc chắn?`
          }
          confirmLabel={confirm.type === 'deactivate' ? 'Vô hiệu hóa' : 'Kích hoạt'}
          confirmClass={confirm.type === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Drawers & Modals */}
      {drawer && (
        <UserDrawer
          mode={drawer.mode}
          user={drawer.user}
          onClose={() => setDrawer(null)}
          onSaved={handleUserSaved}
        />
      )}
      {roleModal && (
        <AssignRoleModal
          user={roleModal}
          onClose={() => setRoleModal(null)}
          onSaved={handleRoleSaved}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full uppercase tracking-wide">
            <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
            Administrator Workspace
          </span>
          <h1 className="font-heading text-3xl md:text-4xl text-primary font-bold mt-2">
            Quản lý Người dùng
          </h1>
          <p className="text-sm text-slate mt-1">
            Phân quyền truy cập, tạo tài khoản và quản trị vai trò trong hệ thống NexusPort.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-[20px]">search</span>
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Tìm theo tên, email..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-chalk rounded-xl text-sm text-primary placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-signal-orange/30 focus:border-signal-orange shadow-sm"
            />
          </div>
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-2 bg-carbon text-white h-10 px-5 rounded-full text-sm font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm người dùng
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng tài khoản', value: total,                                                icon: 'group',          color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Đang hoạt động', value: users.filter(u => u.isActive).length,                 icon: 'check_circle',   color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Bị vô hiệu hóa', value: users.filter(u => !u.isActive).length,               icon: 'block',          color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'Vai trò',        value: VALID_ROLES.length,                                    icon: 'badge',          color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-4 flex items-center gap-3 border border-chalk`}>
            <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
              <span className={`material-symbols-outlined ${s.color} text-[22px]`}>{s.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-carbon">{s.value}</div>
              <div className="text-xs text-slate font-medium">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-chalk">
        {[
          { key: 'users', label: 'Tài khoản người dùng', icon: 'manage_accounts' },
          { key: 'roles', label: 'Danh mục Vai trò',      icon: 'badge'           },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'text-carbon border-signal-orange font-bold'
                : 'text-slate border-transparent hover:text-carbon hover:border-chalk'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Users ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate uppercase tracking-wide mr-1">Trạng thái:</span>
            {[
              { value: 'all',      label: 'Tất cả' },
              { value: 'active',   label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Vô hiệu hóa' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => handleFilterChange('status', f.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  statusFilter === f.value
                    ? 'bg-carbon text-white shadow-sm'
                    : 'bg-white border border-chalk text-graphite hover:bg-fog'
                }`}
              >
                {f.label}
              </button>
            ))}

            <span className="text-xs font-bold text-slate uppercase tracking-wide ml-4 mr-1">Vai trò:</span>
            <select
              value={roleFilter}
              onChange={e => handleFilterChange('role', e.target.value)}
              className="h-8 px-3 border border-chalk rounded-full text-xs font-semibold text-carbon bg-white focus:outline-none focus:ring-2 focus:ring-signal-orange/30"
            >
              <option value="all">Tất cả vai trò</option>
              {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-chalk bg-fog/60">
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate uppercase tracking-wide">Người dùng</th>
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate uppercase tracking-wide">Email</th>
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate uppercase tracking-wide">Vai trò</th>
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate uppercase tracking-wide">Trạng thái</th>
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate uppercase tracking-wide">Ngày tạo</th>
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate uppercase tracking-wide text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <span className="material-symbols-outlined text-chalk text-[56px] block mb-3">manage_search</span>
                        <p className="text-slate font-semibold text-sm">Không tìm thấy người dùng nào.</p>
                        {search && <p className="text-slate text-xs mt-1">Thử tìm kiếm với từ khóa khác.</p>}
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id} className="hover:bg-fog/60 transition-colors group">
                        {/* User */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-bold text-carbon text-xs flex-shrink-0 shadow-sm">
                              {getInitials(u.fullName || u.username)}
                            </div>
                            <div>
                              <div className="font-bold text-carbon text-sm">{u.fullName || u.username}</div>
                              {u.fullName && <div className="text-xs text-slate">@{u.username}</div>}
                            </div>
                          </div>
                        </td>
                        {/* Email */}
                        <td className="py-4 px-5 text-sm text-slate">{u.email}</td>
                        {/* Role */}
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${ROLE_COLORS[u.role] || 'bg-chalk text-graphite border-chalk'}`}>
                            {u.role}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="py-4 px-5">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-red-600 font-semibold text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                              Vô hiệu hóa
                            </span>
                          )}
                        </td>
                        {/* Created At */}
                        <td className="py-4 px-5 text-xs text-slate font-mono">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        {/* Actions */}
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Edit */}
                            <button
                              onClick={() => setDrawer({ mode: 'edit', user: u })}
                              title="Chỉnh sửa thông tin"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate hover:text-blue-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            {/* Assign Role */}
                            <button
                              onClick={() => setRoleModal(u)}
                              title="Gán vai trò"
                              className="p-1.5 rounded-lg hover:bg-purple-50 text-slate hover:text-purple-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                            </button>
                            {/* Activate / Deactivate */}
                            <button
                              onClick={() => handleToggleActive(u)}
                              title={u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.isActive
                                  ? 'hover:bg-red-50 text-slate hover:text-red-600'
                                  : 'hover:bg-emerald-50 text-slate hover:text-emerald-600'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {u.isActive ? 'block' : 'check_circle'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-chalk bg-fog/30">
                <span className="text-xs text-slate">
                  Hiển thị trang {page}/{totalPages} — Tổng: {total} tài khoản
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-chalk hover:bg-white text-slate disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = i + 1
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                          page === p ? 'bg-carbon text-white' : 'border border-chalk hover:bg-white text-slate'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-chalk hover:bg-white text-slate disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Roles ── */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {VALID_ROLES.map(role => (
            <div key={role} className="bg-white border border-chalk rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-bold text-carbon text-base leading-tight">{role}</h4>
                <span className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ROLE_COLORS[role] || 'bg-chalk text-graphite border-chalk'}`}>
                  {roleCounts[role] ?? 0} tài khoản
                </span>
              </div>
              <p className="text-xs text-slate leading-relaxed">{ROLE_DESCS[role]}</p>
              <div className="pt-3 border-t border-chalk flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate">
                  {roleCounts[role] ?? 0} người dùng được gán
                </span>
                <button
                  onClick={() => { setRoleFilter(role); setActiveTab('users') }}
                  className="text-[11px] font-bold text-signal-orange hover:underline flex items-center gap-0.5"
                >
                  Xem danh sách
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
