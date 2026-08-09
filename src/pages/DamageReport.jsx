import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DamageReport() {
  const navigate = useNavigate()
  const [dots, setDots] = useState([{ x: 30, y: 40, face: 'back' }])
  const [severity, setSeverity] = useState('light')
  const [damageType, setDamageType] = useState('Móp')

  const handleAddDot = (e, face) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setDots((prev) => [...prev, { x, y, face }])
  }

  return (
    <div className="bg-[#efefef] text-[#1c1b1b] min-h-screen flex font-sans">
      {/* Sidebar */}
      <nav className="w-[200px] h-screen fixed left-0 top-0 border-r border-[#e8e8e8] bg-white flex flex-col z-20">
        <div className="p-6">
          <h1 className="text-[22px] font-bold text-[#080808]">NexusPort</h1>
          <p className="text-[12px] text-[#4d4d4d]">Terminal Alpha-7</p>
        </div>
        <ul className="flex flex-col mt-2 text-[13px] w-full">
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 text-[#4d4d4d] hover:bg-[#efefef]" onClick={() => navigate('/')}>
              <span>📊</span>
              <span>Tổng quan</span>
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 text-[#4d4d4d] hover:bg-[#efefef]" onClick={() => navigate('/cargo')}>
              <span>📋</span>
              <span>Khai báo hàng</span>
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 bg-[#f5f5f5] border-l-4 border-[#ff682c] text-[#080808] font-bold">
              <span>⚠️</span>
              <span>Báo cáo hư hỏng</span>
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-6 py-3 text-[#4d4d4d] hover:bg-[#efefef]" onClick={() => navigate('/berth')}>
              <span>🚢</span>
              <span>Cầu cảng</span>
            </button>
          </li>
        </ul>
        <div className="mt-auto p-6 w-full">
          <button className="w-full bg-[#202020] text-white h-[40px] rounded-full text-[13px] hover:bg-[#090808]" onClick={() => navigate('/')}>
            ← Trang chủ
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 ml-[200px] flex flex-col min-w-0 p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col lg:flex-row gap-6">
          {/* Left Column */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <header className="bg-white p-5 rounded-xl border border-[#e8e8e8]">
              <h2 className="text-[22px] font-bold text-[#202020] mb-3">Báo cáo hư hỏng</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Quét hoặc nhập mã container..."
                  className="w-full h-10 rounded-lg border border-[#828282] px-3 text-[13px] outline-none focus:border-[#ff682c]"
                  defaultValue="MSKU 876921-4"
                />
              </div>
            </header>

            {/* Container Info */}
            <section className="bg-white rounded-xl p-5 border border-[#e8e8e8] relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#ff682c]" />
              <div className="flex flex-col gap-3">
                <h3 className="text-[20px] font-mono font-bold text-[#202020]">MSKU 876921-4</h3>
                <div className="flex items-center gap-2 text-[12px] text-[#4d4d4d]">
                  <span>Maersk Line</span>
                  <span>•</span>
                  <span className="bg-[#ebe7e7] px-2 py-0.5 rounded text-[#202020] font-semibold">40ft HC</span>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#202020] text-white rounded text-[12px]">
                    📍 Yard Block G2
                  </span>
                </div>

                <hr className="my-2 border-[#e8e8e8]" />

                <div>
                  <h4 className="text-[14px] font-bold text-[#202020] mb-2">Mức độ nghiêm trọng</h4>
                  <div className="flex flex-col gap-2 text-[13px]">
                    {[
                      { key: 'light', label: 'Nhẹ (Thẩm mỹ)' },
                      { key: 'medium', label: 'Vừa (Cần sửa chữa)' },
                      { key: 'severe', label: 'Nặng (Hỏng cấu trúc)' },
                    ].map((s) => (
                      <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sev"
                          checked={severity === s.key}
                          onChange={() => setSeverity(s.key)}
                          className="accent-[#ff682c]"
                        />
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <hr className="my-2 border-[#e8e8e8]" />

                <div>
                  <h4 className="text-[14px] font-bold text-[#202020] mb-2">Mô tả chi tiết</h4>
                  <textarea
                    placeholder="Nhập chi tiết hư hỏng..."
                    className="w-full h-24 p-3 border border-[#828282] rounded-lg text-[13px] outline-none focus:border-[#ff682c]"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="w-full lg:w-2/3 flex flex-col gap-4">
            {/* Damage Workspace */}
            <section className="bg-white rounded-xl p-6 border border-[#e8e8e8] flex flex-col gap-6">
              <div>
                <h4 className="text-[14px] font-bold text-[#202020] mb-3">Loại hư hỏng</h4>
                <div className="flex flex-wrap gap-2">
                  {['Móp', 'Trầy xước', 'Thủng', 'Đứt niêm phong', 'Rỉ sét', 'Biến dạng cấu trúc'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setDamageType(t)}
                      className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                        damageType === t ? 'bg-[#202020] text-white' : 'bg-[#e8e8e8] text-[#4d4d4d] hover:bg-[#ebe7e7]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diagram */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[14px] font-bold text-[#202020]">Đánh dấu vị trí hư hỏng</h4>
                  <span className="text-[11px] text-[#828282]">Click lên ô để thêm vị trí</span>
                </div>

                <div className="bg-[#efefef] border border-[#e8e8e8] rounded-lg p-6">
                  <div className="grid grid-cols-3 gap-3 max-w-[480px] mx-auto select-none">
                    {/* Top */}
                    <div
                      className="col-start-2 border-2 border-[#c4c7c7] bg-white h-16 relative cursor-pointer flex items-center justify-center text-[11px] text-[#828282]"
                      onClick={(e) => handleAddDot(e, 'top')}
                    >
                      Top
                      {dots.filter(d => d.face === 'top').map((d, i) => (
                        <div key={i} className="absolute w-3 h-3 bg-[#ff682c] rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }} />
                      ))}
                    </div>

                    {/* Left, Front, Right */}
                    <div
                      className="col-start-1 border-2 border-[#c4c7c7] bg-white h-32 relative cursor-pointer flex items-center justify-center text-[11px] text-[#828282]"
                      onClick={(e) => handleAddDot(e, 'left')}
                    >
                      Left
                      {dots.filter(d => d.face === 'left').map((d, i) => (
                        <div key={i} className="absolute w-3 h-3 bg-[#ff682c] rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }} />
                      ))}
                    </div>

                    <div
                      className="col-start-2 border-2 border-[#c4c7c7] bg-white h-32 relative cursor-pointer flex items-center justify-center text-[11px] text-[#828282]"
                      onClick={(e) => handleAddDot(e, 'front')}
                    >
                      Front
                      {dots.filter(d => d.face === 'front').map((d, i) => (
                        <div key={i} className="absolute w-3 h-3 bg-[#ff682c] rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }} />
                      ))}
                    </div>

                    <div
                      className="col-start-3 border-2 border-[#c4c7c7] bg-white h-32 relative cursor-pointer flex items-center justify-center text-[11px] text-[#828282]"
                      onClick={(e) => handleAddDot(e, 'right')}
                    >
                      Right
                      {dots.filter(d => d.face === 'right').map((d, i) => (
                        <div key={i} className="absolute w-3 h-3 bg-[#ff682c] rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }} />
                      ))}
                    </div>

                    {/* Back */}
                    <div
                      className="col-start-2 border-2 border-[#c4c7c7] bg-white h-32 relative cursor-pointer flex items-center justify-center text-[11px] text-[#828282] mt-2"
                      onClick={(e) => handleAddDot(e, 'back')}
                    >
                      Back
                      {dots.filter(d => d.face === 'back').map((d, i) => (
                        <div key={i} className="absolute w-3.5 h-3.5 bg-[#ff682c] rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-white text-[9px] font-bold" style={{ left: `${d.x}%`, top: `${d.y}%` }}>
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Photos */}
            <section className="bg-white rounded-xl p-5 border border-[#e8e8e8]">
              <h4 className="text-[14px] font-bold text-[#202020] mb-3">Ảnh chụp bằng chứng hư hỏng</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                <div className="w-[100px] h-[100px] rounded-lg border bg-cover bg-center shrink-0" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=80')" }} />
                <button className="w-[100px] h-[100px] rounded-lg border-2 border-dashed border-[#e8e8e8] hover:border-[#ff682c] flex flex-col items-center justify-center text-[12px] text-[#828282] shrink-0">
                  <span>📷</span>
                  <span>Thêm ảnh</span>
                </button>
              </div>
            </section>

            {/* Actions */}
            <section className="bg-white p-4 rounded-xl border border-[#e8e8e8] flex justify-between items-center">
              <button className="px-6 h-[40px] rounded-full border border-[#e8e8e8] text-[#4d4d4d] hover:border-[#202020] font-semibold text-[13px]" onClick={() => navigate('/')}>
                Hủy bỏ
              </button>
              <button
                className="px-8 h-[40px] rounded-full bg-[#ff682c] text-white font-bold text-[14px] hover:bg-[#e05318] shadow-md flex items-center gap-2"
                onClick={() => { alert('Gửi báo cáo hư hỏng thành công!'); navigate('/') }}
              >
                <span>📤</span>
                <span>Gửi báo cáo hư hỏng</span>
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
