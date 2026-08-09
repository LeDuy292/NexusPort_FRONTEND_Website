import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function CarrierProfile() {
  const navigate = useNavigate()
  const [toastMessage, setToastMessage] = useState('')

  const handleSave = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2500)
  }

  return (
    <div className="bg-[#efefef] text-[#080808] min-h-screen font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-[#202020] text-white px-6 py-3 rounded-lg shadow-xl text-[14px] flex items-center gap-2 z-50 animate-bounce">
          <span className="text-[#ff682c]">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-[#e8e8e8] h-16 flex items-center justify-between px-8 sticky top-0 z-40 ml-[200px]">
        <div className="text-[16px] font-bold text-[#080808]">NexusPort Carrier Admin</div>
        <div className="flex items-center gap-4 text-[14px]">
          <button className="text-[#4d4d4d] hover:text-[#ff682c]" onClick={() => navigate('/')}>
            Trang chủ
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-[200px] bg-white border-r border-[#e8e8e8] fixed left-0 top-0 h-full flex flex-col py-8 z-50">
          <div className="px-6 mb-8">
            <div className="text-[18px] font-bold text-[#080808] border-l-4 border-[#ff682c] pl-2 mb-1">
              NexusPort
            </div>
            <div className="text-[12px] text-[#4d4d4d]">Carrier Admin</div>
          </div>
          <ul className="flex-1 text-[13px] font-medium">
            <li>
              <button className="w-full flex items-center gap-3 px-6 h-[40px] bg-[#f5f5f5] border-l-4 border-[#ff682c] text-[#080808] font-bold text-left">
                <span>🏢</span>
                <span>Hồ sơ công ty</span>
              </button>
            </li>
            <li>
              <button className="w-full flex items-center gap-3 px-6 h-[40px] text-[#4d4d4d] hover:bg-[#efefef] text-left" onClick={() => navigate('/cargo')}>
                <span>📋</span>
                <span>Khai báo hàng</span>
              </button>
            </li>
            <li>
              <button className="w-full flex items-center gap-3 px-6 h-[40px] text-[#4d4d4d] hover:bg-[#efefef] text-left" onClick={() => navigate('/damage-report')}>
                <span>⚠️</span>
                <span>Báo cáo hư hỏng</span>
              </button>
            </li>
          </ul>
          <div className="px-6 mt-auto">
            <button className="w-full h-11 bg-[#202020] text-white rounded-full text-[13px] font-medium hover:bg-[#080808]" onClick={() => navigate('/')}>
              ← Quay lại Demo Nav
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 ml-[200px] p-8 max-w-[1280px] mx-auto">
          <h1 className="text-[32px] font-bold text-[#080808] mb-8">Hồ sơ công ty hãng tàu</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols */}
            <div className="lg:col-span-2 space-y-8">
              {/* Basic Info */}
              <div className="bg-white rounded-xl p-8 border border-[#e8e8e8]">
                <h2 className="text-[16px] font-bold border-b border-[#e8e8e8] pb-3 mb-6">Thông tin cơ bản</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] tracking-wider block mb-1">Tên công ty</label>
                    <input type="text" defaultValue="NexusPort Logistics Inc." className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] tracking-wider block mb-1">Mã số đăng ký</label>
                    <input type="text" defaultValue="CRN-89234-X" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <button className="bg-[#202020] text-white px-6 h-10 rounded-full text-[14px] font-semibold hover:bg-[#ff682c] transition-colors" onClick={() => handleSave('Lưu thông tin cơ bản thành công!')}>
                    Lưu
                  </button>
                </div>
              </div>

              {/* Address Card */}
              <div className="bg-white rounded-xl p-8 border border-[#e8e8e8]">
                <h2 className="text-[16px] font-bold border-b border-[#e8e8e8] pb-3 mb-6">Địa chỉ hoạt động</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] tracking-wider block mb-1">Địa chỉ</label>
                    <input type="text" defaultValue="4500 Freight Terminal Blvd, Suite 200" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] tracking-wider block mb-1">Thành phố</label>
                    <input type="text" defaultValue="Chicago" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] tracking-wider block mb-1">Quốc gia</label>
                    <input type="text" defaultValue="United States" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <button className="bg-[#202020] text-white px-6 h-10 rounded-full text-[14px] font-semibold hover:bg-[#ff682c] transition-colors" onClick={() => handleSave('Lưu địa chỉ thành công!')}>
                    Lưu địa chỉ
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side Column */}
            <div className="space-y-8">
              {/* Representative */}
              <div className="bg-white rounded-xl p-6 border border-[#e8e8e8]">
                <h2 className="text-[16px] font-bold border-b border-[#e8e8e8] pb-3 mb-6">Người đại diện</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] block mb-1">Họ và tên</label>
                    <input type="text" defaultValue="Sarah Jenkins" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] block mb-1">Chức danh</label>
                    <input type="text" defaultValue="Operations Director" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] block mb-1">Email</label>
                    <input type="email" defaultValue="s.jenkins@nexusport.com" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-[#4d4d4d] block mb-1">Số điện thoại</label>
                    <input type="tel" defaultValue="+1 (555) 019-2834" className="w-full h-10 border border-[#828282] rounded px-3 text-[14px]" />
                  </div>
                </div>
                <button className="w-full mt-6 bg-[#202020] text-white h-10 rounded-full text-[14px] font-semibold hover:bg-[#ff682c] transition-colors" onClick={() => handleSave('Cập nhật người đại diện thành công!')}>
                  Cập nhật liên hệ
                </button>
              </div>

              {/* Status Card */}
              <div className="bg-white rounded-xl p-6 border border-[#e8e8e8]">
                <h2 className="text-[16px] font-bold border-b border-[#e8e8e8] pb-3 mb-4">Trạng thái tài khoản</h2>
                <div className="flex items-center justify-between mb-3 text-[14px]">
                  <span className="text-[#4d4d4d]">Trạng thái</span>
                  <span className="px-3 py-1 bg-[#fff8f5] text-[#ff682c] border border-[#ff682c] rounded-full text-[12px] font-bold">
                    ● Hoạt động
                  </span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-[#4d4d4d]">Hạng hãng tàu</span>
                  <span className="font-bold text-[#080808]">Cao cấp (Premium)</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
