import React, { useState } from 'react'

const initialUsers = [
  { id: 1, name: 'J. Smith', initials: 'JS', email: 'jsmith@nexusport.co', role: 'Admin', status: 'Active', lastLogin: '2 mins ago' },
  { id: 2, name: 'A. Lin', initials: 'AL', email: 'alin@nexusport.co', role: 'Operator', status: 'Inactive', lastLogin: '3 days ago' },
  { id: 3, name: 'M. Reyes', initials: 'MR', email: 'mreyes@nexusport.co', role: 'Gate Staff', status: 'Locked', lastLogin: 'Oct 12, 08:30' },
  { id: 4, name: 'Tran Van B', initials: 'TB', email: 'tranvanb@carrier.com', role: 'Carrier', status: 'Active', lastLogin: '1 hour ago' },
  { id: 5, name: 'Nguyen Van C', initials: 'NC', email: 'nguyenvanc@yard.co', role: 'Yard Staff', status: 'Active', lastLogin: '5 mins ago' },
]

export default function UserRoleManagement() {
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All')
  const [activeTab, setActiveTab] = useState('users')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // New User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Operator',
    activeImmediately: true
  })

  // Toast state
  const [toastMessage, setToastMessage] = useState('')

  const handleFilterClick = (roleName) => {
    setSelectedRoleFilter(roleName)
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = selectedRoleFilter === 'All' || u.role.toLowerCase() === selectedRoleFilter.toLowerCase()
    return matchesSearch && matchesRole
  })

  const handleSaveUser = (e) => {
    e.preventDefault()
    if (!newUser.name || !newUser.email) return

    const created = {
      id: Date.now(),
      name: newUser.name,
      initials: newUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
      email: newUser.email,
      role: newUser.role,
      status: newUser.activeImmediately ? 'Active' : 'Inactive',
      lastLogin: 'Vừa tạo xong'
    }

    setUsers([created, ...users])
    setIsDrawerOpen(false)
    setNewUser({ name: '', email: '', role: 'Operator', activeImmediately: true })
    setToastMessage(`🎉 Đã thêm người dùng mới: ${created.name} (${created.role})!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
            Administrator Workspace
          </span>
          <h2 className="font-heading text-4xl text-primary font-bold mt-1">Quản lý Người dùng & Vai trò</h2>
          <p className="text-sm text-slate mt-1">Phân quyền truy cập hệ thống, quản trị tài khoản và theo dõi lịch sử thao tác (Audit Log).</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-[20px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tài khoản..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-chalk rounded-lg text-xs font-bold text-primary placeholder:text-slate focus:outline-none focus:ring-1 focus:ring-signal-orange shadow-sm"
            />
          </div>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center justify-center gap-2 bg-carbon text-white h-10 px-5 rounded-full text-xs font-bold hover:bg-black transition-colors shadow whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm người dùng mới
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-chalk">
        {[
          { key: 'users', label: 'Tài khoản người dùng' },
          { key: 'roles', label: 'Danh mục Vai trò' },
          { key: 'audit_log', label: 'Nhật ký thao tác' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 font-semibold text-xs transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-signal-orange font-bold'
                : 'text-slate hover:text-carbon'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Role Filter Pills */}
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {['All', 'Admin', 'Operator', 'Gate Staff', 'Yard Staff', 'Carrier'].map(roleName => (
              <button
                key={roleName}
                onClick={() => handleFilterClick(roleName)}
                className={`px-4 py-1.5 rounded-full transition-colors ${
                  selectedRoleFilter === roleName
                    ? 'bg-carbon text-white shadow-sm'
                    : 'bg-chalk text-graphite hover:bg-mist'
                }`}
              >
                {roleName === 'All' ? 'Tất cả vai trò' : roleName}
              </button>
            ))}
          </div>

          {/* Users Table Card */}
          <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-chalk text-slate font-bold uppercase text-[10px]">
                    <th className="pb-3 px-4">Người dùng</th>
                    <th className="pb-3 px-4">Địa chỉ Email</th>
                    <th className="pb-3 px-4">Vai trò (Role)</th>
                    <th className="pb-3 px-4">Trạng thái</th>
                    <th className="pb-3 px-4">Đăng nhập gần nhất</th>
                    <th className="pb-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-fog transition-colors group font-medium">
                      <td className="py-4 px-4 border-l-4 border-transparent group-hover:border-signal-orange">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center font-bold text-carbon text-xs">
                            {u.initials}
                          </div>
                          <span className="font-bold text-carbon">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate">{u.email}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                          u.role === 'Admin' ? 'bg-carbon text-white' : 'bg-chalk text-graphite'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            u.status === 'Active' ? 'bg-signal-orange' : u.status === 'Locked' ? 'bg-red-500 animate-pulse' : 'bg-slate'
                          }`}></span>
                          <span className={`font-bold ${u.status === 'Locked' ? 'text-red-600' : 'text-carbon'}`}>
                            {u.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate">{u.lastLogin}</td>
                      <td className="py-4 px-4 text-right">
                        <button className="text-slate hover:text-carbon p-1 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button className="text-slate hover:text-carbon p-1 ml-1 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate text-xs font-semibold">
                        Không tìm thấy người dùng nào phù hợp với từ khóa "{searchQuery}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT: ROLES */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {[
            { name: 'Administrator', desc: 'Quyền quản trị cao nhất toàn bộ hệ thống cảng', count: '2 tài khoản' },
            { name: 'Dispatcher', desc: 'Quản lý điều độ phương tiện & theo dõi tàu biển', count: '5 tài khoản' },
            { name: 'Yard Operator', desc: 'Quản lý sơ đồ xếp chồng container & điều phối thiết bị bãi', count: '8 tài khoản' },
            { name: 'Gate Officer', desc: 'Nhận diện OCR AI & phê duyệt xe ra vào cổng', count: '12 tài khoản' },
            { name: 'Transport Company', desc: 'Doanh nghiệp vận tải & Hãng tàu đăng ký booking', count: '45 tài khoản' },
          ].map((r, idx) => (
            <div key={idx} className="bg-white border border-chalk rounded-xl p-6 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-carbon text-base">{r.name}</h4>
                <span className="text-[10px] font-bold bg-fog border border-chalk px-2.5 py-0.5 rounded-full text-slate">
                  {r.count}
                </span>
              </div>
              <p className="text-xs text-slate">{r.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOG */}
      {activeTab === 'audit_log' && (
        <div className="bg-white border border-chalk rounded-xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <h3 className="font-heading text-lg font-bold text-carbon border-b border-chalk pb-3">Nhật ký truy cập & Thao tác hệ thống</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-fog rounded-lg border border-chalk flex justify-between items-center">
              <div>
                <span className="font-bold text-carbon">J. Smith</span> <span className="text-slate">đã phê duyệt cấp quyền cho tài khoản</span> <strong className="text-carbon">A. Lin</strong>
              </div>
              <span className="text-[10px] text-slate font-mono">10 phút trước</span>
            </div>
            <div className="p-3 bg-fog rounded-lg border border-chalk flex justify-between items-center">
              <div>
                <span className="font-bold text-carbon">Gate Camera AI</span> <span className="text-slate font-bold text-signal-orange">[CẢNH BÁO]</span> <span className="text-slate">Xe biển số NEX 8922 không khớp giấy phép</span>
              </div>
              <span className="text-[10px] text-slate font-mono">45 phút trước</span>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in Drawer (Add New User Panel) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full border-l border-chalk shadow-2xl flex flex-col justify-between p-8 space-y-6 animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex justify-between items-center border-b border-chalk pb-4 mb-6">
                <h3 className="font-heading text-2xl font-bold text-carbon">Thêm người dùng mới</h3>
                <button onClick={() => setIsDrawerOpen(false)} className="text-slate hover:text-carbon">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-5 text-xs font-bold">
                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Nhập tên người dùng..."
                    className="w-full h-10 px-3 border border-chalk rounded-lg text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                  />
                </div>

                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Địa chỉ Email</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@nexusport.co"
                    className="w-full h-10 px-3 border border-chalk rounded-lg text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                  />
                </div>

                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Phân bổ Vai trò (Role)</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full h-10 px-3 border border-chalk rounded-lg text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                  >
                    <option value="Admin">Administrator (Quản trị viên)</option>
                    <option value="Operator">Yard Operator (Nhân viên bãi)</option>
                    <option value="Gate Staff">Gate Officer (Nhân viên cổng)</option>
                    <option value="Dispatcher">Dispatcher (Điều độ viên)</option>
                    <option value="Carrier">Transport Company (Hãng tàu)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-chalk">
                  <div>
                    <div className="text-carbon font-bold">Trạng thái tài khoản</div>
                    <div className="text-[10px] text-slate font-normal">Cho phép đăng nhập ngay sau khi tạo</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newUser.activeImmediately}
                    onChange={e => setNewUser({ ...newUser, activeImmediately: e.target.checked })}
                    className="w-5 h-5 rounded text-signal-orange focus:ring-signal-orange border-chalk"
                  />
                </div>

                <div className="pt-6 border-t border-chalk flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="h-10 px-5 border border-chalk rounded-full text-slate font-bold hover:bg-fog"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-6 bg-carbon text-white rounded-full font-bold hover:bg-black transition-colors shadow"
                  >
                    Lưu người dùng
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
