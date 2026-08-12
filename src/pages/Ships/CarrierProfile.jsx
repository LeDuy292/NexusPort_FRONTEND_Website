import React, { useState } from 'react'

export default function CarrierProfile() {
  const [toastMessage, setToastMessage] = useState('')

  // Form State
  const [profile, setProfile] = useState({
    companyName: 'NexusPort Logistics Inc.',
    regNumber: 'CRN-89234-X',
    address: '4500 Freight Terminal Blvd, Suite 200',
    city: 'Hải Phòng',
    state: 'HP',
    zip: '180000',
    country: 'Việt Nam',
    repName: 'Sarah Jenkins',
    repTitle: 'Giám đốc Vận hành',
    repEmail: 's.jenkins@nexusport.com',
    repPhone: '+84 (0225) 388-9922'
  })

  const handleSave = (sectionName) => {
    setToastMessage(`✓ Đã lưu thay đổi cho phần "${sectionName}" thành công!`)
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

      {/* Header */}
      <div>
        <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
          Carrier Admin Settings
        </span>
        <h2 className="font-heading text-4xl text-carbon font-bold mt-1">Hồ sơ Công ty & Cấu hình Hãng tàu</h2>
        <p className="text-sm text-slate mt-1">Cập nhật thông tin doanh nghiệp, người đại diện liên hệ và địa chỉ hoạt động.</p>
      </div>

      {/* Bento Grid Layout (Left 8 cols / Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Basic Info Card */}
          <div className="bg-white rounded-xl p-8 border border-chalk shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start gap-8">
              {/* Logo Upload Avatar */}
              <div className="relative group cursor-pointer shrink-0">
                <div className="w-24 h-24 rounded-full bg-mist border-2 border-dashed border-chalk flex items-center justify-center overflow-hidden group-hover:border-signal-orange transition-colors">
                  <span className="material-symbols-outlined text-slate text-3xl">photo_camera</span>
                  <div className="absolute inset-0 bg-carbon/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <span className="material-symbols-outlined text-white">upload</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <h3 className="font-heading text-lg font-bold text-carbon border-b border-chalk pb-2">Thông tin cơ bản</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">Tên công ty / Hãng tàu</label>
                    <input
                      type="text"
                      value={profile.companyName}
                      onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                      className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">Mã số đăng ký doanh nghiệp</label>
                    <input
                      type="text"
                      value={profile.regNumber}
                      onChange={e => setProfile({ ...profile, regNumber: e.target.value })}
                      className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon font-mono focus:outline-none focus:ring-1 focus:ring-signal-orange"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-chalk">
              <button
                onClick={() => handleSave('Thông tin cơ bản')}
                className="bg-carbon text-white px-6 h-10 rounded-full font-bold text-xs hover:bg-black transition-colors shadow"
              >
                Lưu thông tin
              </button>
            </div>
          </div>

          {/* Address Card */}
          <div className="bg-white rounded-xl p-8 border border-chalk shadow-sm space-y-6">
            <h3 className="font-heading text-lg font-bold text-carbon border-b border-chalk pb-2">Địa chỉ hoạt động</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
              <div className="sm:col-span-2">
                <label className="block text-slate uppercase text-[10px] mb-1">Địa chỉ trụ sở</label>
                <input
                  type="text"
                  value={profile.address}
                  onChange={e => setProfile({ ...profile, address: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Thành phố</label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={e => setProfile({ ...profile, city: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Tỉnh / Thành phố</label>
                <input
                  type="text"
                  value={profile.state}
                  onChange={e => setProfile({ ...profile, state: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Mã bưu điện (Zip code)</label>
                <input
                  type="text"
                  value={profile.zip}
                  onChange={e => setProfile({ ...profile, zip: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Quốc gia</label>
                <input
                  type="text"
                  value={profile.country}
                  onChange={e => setProfile({ ...profile, country: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-chalk">
              <button
                onClick={() => handleSave('Địa chỉ hoạt động')}
                className="bg-carbon text-white px-6 h-10 rounded-full font-bold text-xs hover:bg-black transition-colors shadow"
              >
                Lưu địa chỉ
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Representative Contact */}
          <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm space-y-4">
            <h3 className="font-heading text-lg font-bold text-carbon border-b border-chalk pb-2">Người đại diện liên hệ</h3>
            
            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={profile.repName}
                  onChange={e => setProfile({ ...profile, repName: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Chức danh</label>
                <input
                  type="text"
                  value={profile.repTitle}
                  onChange={e => setProfile({ ...profile, repTitle: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Địa chỉ email</label>
                <input
                  type="email"
                  value={profile.repEmail}
                  onChange={e => setProfile({ ...profile, repEmail: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={profile.repPhone}
                  onChange={e => setProfile({ ...profile, repPhone: e.target.value })}
                  className="w-full h-10 rounded-lg border border-chalk bg-transparent px-3 text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => handleSave('Người đại diện')}
                className="w-full bg-carbon text-white h-10 rounded-full font-bold text-xs hover:bg-black transition-colors shadow"
              >
                Cập nhật liên hệ
              </button>
            </div>
          </div>

          {/* Quick Account Status Widget */}
          <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm space-y-4">
            <h3 className="font-heading text-lg font-bold text-carbon border-b border-chalk pb-2">Trạng thái tài khoản</h3>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-graphite font-bold">Xác minh doanh nghiệp</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-700 font-bold border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span> Hoạt động
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-chalk">
              <span className="text-graphite font-bold">Hạng Hãng tàu</span>
              <span className="font-bold text-signal-orange">VIP Cao cấp</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
