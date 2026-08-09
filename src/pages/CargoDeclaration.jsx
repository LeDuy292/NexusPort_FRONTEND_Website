import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function CargoDeclaration() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState('reefer')
  const [temp, setTemp] = useState(-18)
  const [power, setPower] = useState('380V')

  return (
    <div className="bg-[#efefef] text-[#202020] flex min-h-screen font-sans">
      {/* Sidebar */}
      <nav className="w-[200px] h-screen fixed left-0 top-0 border-r border-[#e8e8e8] bg-white flex flex-col z-20">
        <div className="p-6">
          <h1 className="text-[24px] font-bold text-[#080808]">NexusPort</h1>
          <p className="text-[13px] text-[#4d4d4d]">Terminal Logistics</p>
        </div>
        <ul className="flex flex-col mt-4 text-[14px] w-full">
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 text-[#4d4d4d] hover:bg-[#efefef] transition-colors" onClick={() => navigate('/')}>
              <span>📊</span>
              <span>Tổng quan</span>
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 bg-[#f5f5f5] border-l-4 border-[#ff682c] text-[#080808] font-semibold">
              <span>📋</span>
              <span>Khai báo hàng</span>
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 text-[#4d4d4d] hover:bg-[#efefef] transition-colors" onClick={() => navigate('/damage-report')}>
              <span>⚠️</span>
              <span>Báo cáo hư hỏng</span>
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 text-[#4d4d4d] hover:bg-[#efefef] transition-colors" onClick={() => navigate('/berth')}>
              <span>🚢</span>
              <span>Cầu cảng</span>
            </button>
          </li>
        </ul>
        <div className="mt-auto p-6 w-full">
          <button className="w-full bg-[#202020] text-white h-[44px] rounded-full text-[14px] hover:bg-[#090808] transition-colors" onClick={() => navigate('/')}>
            ← Trang chủ
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 ml-[200px] flex flex-col min-w-0">
        <header className="h-16 bg-[#efefef] flex justify-between items-center px-8 sticky top-0 z-10 border-b border-[#e8e8e8]">
          <div className="flex items-center gap-6 text-[13px] text-[#4d4d4d]">
            <span className="font-semibold text-[#080808]">KHAI BÁO HÀNG HÓA ĐẶC BIỆT</span>
          </div>
          <button className="text-[13px] text-[#ff682c] font-semibold" onClick={() => navigate('/')}>✕ Đóng</button>
        </header>

        <main className="flex-1 p-8 w-full max-w-[1280px] mx-auto flex flex-col gap-8 pb-20">
          <div>
            <h1 className="text-[32px] font-bold text-[#202020]">Khai báo hàng hóa đặc biệt</h1>
            <p className="text-[15px] text-[#4d4d4d] mt-1">Khai báo các yêu cầu xử lý đặc biệt cho container của bạn.</p>
          </div>

          {/* Cargo Type Selection */}
          <section className="flex flex-col gap-4">
            <h2 className="text-[18px] font-semibold text-[#202020]">Chọn loại hàng</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'reefer', icon: '❄️', title: 'Hàng lạnh', desc: 'Hàng hóa kiểm soát nhiệt độ yêu cầu nguồn điện liên tục.' },
                { id: 'dg', icon: '⚠️', title: 'Hàng nguy hiểm', desc: 'Vật liệu nguy hiểm tuân thủ mã IMDG.' },
                { id: 'perishable', icon: '🌱', title: 'Hàng mau hỏng', desc: 'Hàng hóa nhạy cảm với thời gian và môi trường.' },
                { id: 'oog', icon: '🏋️', title: 'Hàng quá khổ / Quá tải', desc: 'Kích thước quá khổ yêu cầu thiết bị nâng hạ chuyên dụng.' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedType(item.id)}
                  className={`p-6 rounded-xl bg-white border-2 cursor-pointer transition-all relative ${
                    selectedType === item.id ? 'border-[#ff682c] bg-[#fff8f5] shadow-md' : 'border-[#e8e8e8] hover:border-[#4d4d4d]'
                  }`}
                >
                  {selectedType === item.id && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#ff682c] text-white flex items-center justify-center text-[12px] font-bold">
                      ✓
                    </div>
                  )}
                  <div className="text-[32px] mb-2">{item.icon}</div>
                  <h3 className="text-[16px] font-bold text-[#202020] mb-1">{item.title}</h3>
                  <p className="text-[13px] text-[#4d4d4d]">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Form Config for Reefer */}
          {selectedType === 'reefer' && (
            <div className="bg-white p-8 rounded-xl border border-[#e8e8e8] shadow-sm flex flex-col gap-6">
              <h3 className="text-[18px] font-bold text-[#202020] border-l-4 border-[#ff682c] pl-3">Cấu hình container lạnh</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                  <label className="text-[14px] font-semibold text-[#202020]">Đặt nhiệt độ (°C)</label>
                  <div className="flex items-center justify-between bg-[#f5f5f5] p-6 rounded-lg border border-[#e8e8e8]">
                    <div>
                      <span className="text-[11px] text-[#4d4d4d] uppercase tracking-wider block">Mục tiêu</span>
                      <span className="text-[36px] font-bold text-[#202020]">{temp > 0 ? `+${temp}` : temp}°C</span>
                    </div>
                    <span className="text-[36px]">❄️</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="20"
                    value={temp}
                    onChange={(e) => setTemp(Number(e.target.value))}
                    className="w-full accent-[#ff682c]"
                  />
                  <div className="flex justify-between text-[12px] text-[#828282]">
                    <span>-30°C</span>
                    <span>0°C</span>
                    <span>+20°C</span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <label className="text-[14px] font-semibold text-[#202020]">Yêu cầu nguồn điện</label>
                  <div className="flex gap-4">
                    {['380V', '220V'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPower(p)}
                        className={`flex-1 h-[44px] rounded-full border text-[14px] font-semibold transition-all ${
                          power === p ? 'bg-[#202020] text-white border-[#202020]' : 'border-[#e8e8e8] text-[#4d4d4d] hover:border-[#202020]'
                        }`}
                      >
                        {p} ({p === '380V' ? '3-Phase' : 'Single'})
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="text-[14px] font-semibold text-[#202020]">Hướng dẫn thông gió</label>
                    <textarea
                      placeholder="Ví dụ: 25 cbm/giờ..."
                      className="p-3 border border-[#828282] rounded-lg text-[14px] outline-none focus:border-[#ff682c]"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Config for DG */}
          {selectedType === 'dg' && (
            <div className="bg-white p-8 rounded-xl border border-[#e8e8e8] shadow-sm flex flex-col gap-6">
              <h3 className="text-[18px] font-bold text-[#202020] border-l-4 border-[#ff682c] pl-3">Chi tiết hàng nguy hiểm</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[14px] font-semibold text-[#202020] block mb-1">Số UN</label>
                    <input type="text" placeholder="Ví dụ: 1993" className="w-full p-3 border border-[#828282] rounded-lg text-[14px]" />
                  </div>
                  <div>
                    <label className="text-[14px] font-semibold text-[#202020] block mb-1">Tên vận chuyển thích hợp</label>
                    <input type="text" placeholder="Ví dụ: CHẤT LỎNG DỄ CHÁY" className="w-full p-3 border border-[#828282] rounded-lg text-[14px]" />
                  </div>
                </div>
                <div className="border-2 border-dashed border-[#e8e8e8] rounded-xl p-6 flex flex-col items-center justify-center text-center">
                  <span className="text-[40px] mb-2">☁️</span>
                  <p className="font-semibold text-[#202020]">Kéo & thả tệp bản tóm tắt vào đây</p>
                  <p className="text-[12px] text-[#828282] mt-1">Định dạng hỗ trợ: PDF, JPG, PNG (Tối đa 10MB)</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Table */}
          <section className="flex flex-col gap-4">
            <h2 className="text-[18px] font-semibold text-[#202020]">Xem lại & Gửi</h2>
            <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] text-[13px] text-[#4d4d4d] border-b border-[#e8e8e8]">
                    <th className="py-3 px-6">Mã container</th>
                    <th className="py-3 px-6">Loại hàng</th>
                    <th className="py-3 px-6">Chi tiết</th>
                    <th className="py-3 px-6 text-right">Phụ phí</th>
                  </tr>
                </thead>
                <tbody className="text-[14px]">
                  <tr className="border-b border-[#e8e8e8]">
                    <td className="py-4 px-6 font-mono font-bold">MSKU 908123-4</td>
                    <td className="py-4 px-6">Hàng lạnh</td>
                    <td className="py-4 px-6 text-[#4d4d4d]">{temp}°C, {power}</td>
                    <td className="py-4 px-6 text-right">$150.00</td>
                  </tr>
                  <tr className="bg-[#fff8f5] font-semibold">
                    <td colSpan={3} className="py-4 px-6 text-right">Tổng phí xử lý ước tính</td>
                    <td className="py-4 px-6 text-right text-[#ff682c]">$150.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <button
                className="bg-[#ff682c] text-white px-10 h-[48px] rounded-full font-bold text-[15px] hover:bg-[#e05318] transition-colors shadow-md"
                onClick={() => { alert('Khai báo thành công!'); navigate('/') }}
              >
                Gửi khai báo
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
