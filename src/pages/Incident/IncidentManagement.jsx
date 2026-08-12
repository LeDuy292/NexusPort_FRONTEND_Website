import React, { useState, useEffect } from 'react'

const initialIncidents = [
  {
    id: 'INC-2023-8942',
    code: 'INC-2023-8942',
    title: 'Tắc nghẽn tại Cổng 4',
    summary: 'Hàng đợi xe tải kéo dài vượt quá khu vực chờ quy định, ảnh hưởng đến đường bộ. AI phát hiện mật độ cao...',
    priority: 'KHẨN CẤP',
    priorityColor: 'text-signal-orange border-signal-orange bg-orange-50',
    badgeColor: 'bg-[#202020] text-white',
    timeAgo: '10 phút trước',
    tags: ['Cổng', 'Cảnh báo AI'],
    location: 'Cổng 4, Lối vào phía Bắc',
    detectedBy: 'Nexus AI Vision',
    impact: 'Trễ 45 lượt đặt chỗ',
    handler: 'Chưa chỉ định',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=800&auto=format&fit=crop',
    status: 'Mở',
    timeline: [
      { time: '14:22 - Vừa xong', text: 'Cảnh báo được tạo tự động bởi AI Vision.' },
      { time: '14:15', text: 'Phát hiện mật độ giao thông tăng cao bất thường tại Cổng 4.' }
    ]
  },
  {
    id: 'INC-2023-8940',
    code: 'INC-2023-8940',
    title: 'Chậm trễ bảo trì Cần cẩu 2',
    summary: 'Bảo trì theo lịch trình vượt quá thời gian quy định, có khả năng làm chậm trễ tiến độ bốc dỡ hàng...',
    priority: 'CAO',
    priorityColor: 'text-carbon border-carbon bg-mist',
    badgeColor: 'bg-carbon text-white',
    timeAgo: '45 phút trước',
    tags: ['Bến dỡ', 'Cẩu bờ'],
    location: 'Bến D02, Cẩu QC-02',
    detectedBy: 'Hệ thống Cảm biến Cẩu',
    impact: 'Giảm 20% tốc độ dỡ hàng',
    handler: 'Nguyễn Văn Hải (Kỹ thuật)',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop',
    status: 'Đang xử lý',
    timeline: [
      { time: '13:40', text: 'Đội kỹ thuật đã có mặt kiểm tra động cơ cẩu.' },
      { time: '13:00', text: 'Phát hiện quá nhiệt động cơ nâng QC-02.' }
    ]
  },
  {
    id: 'INC-2023-8938',
    code: 'INC-2023-8938',
    title: 'Biến động điện năng Reefer Block C',
    summary: 'Phát hiện sụt áp nhẹ tại Reefer Block C. Không có nguy hiểm tức thời cho hàng hóa lạnh...',
    priority: 'TRUNG BÌNH',
    priorityColor: 'text-amber-700 border-amber-300 bg-amber-50',
    badgeColor: 'bg-amber-100 text-amber-800',
    timeAgo: '2 giờ trước',
    tags: ['Bãi container', 'Nguồn điện'],
    location: 'Block C, Khu Container Lạnh',
    detectedBy: 'Cảm biến Reefer IoT',
    impact: 'Cảnh báo 12 cont lạnh',
    handler: 'Phạm Đức Minh',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800&auto=format&fit=crop',
    status: 'Mở',
    timeline: [
      { time: '12:15', text: 'Chuyển sang nguồn điện dự phòng trạm B3.' }
    ]
  }
]

export default function IncidentManagement() {
  const [incidents, setIncidents] = useState(initialIncidents)
  const [selectedIncident, setSelectedIncident] = useState(initialIncidents[0])
  const [filter, setFilter] = useState('Tất cả')
  const [utcTime, setUtcTime] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Live Clock (Giờ Việt Nam)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setUtcTime(now.toLocaleTimeString('vi-VN'))
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredIncidents = incidents.filter(inc => {
    if (filter === 'Tất cả') return true
    return inc.status.toLowerCase() === filter.toLowerCase()
  })

  const handleResolve = (id) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'Đã giải quyết' } : i))
    setToastMessage(`✅ Đã giải quyết sự cố ${id} thành công!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleEscalate = (id) => {
    setToastMessage(`⚡ Đã leo thang sự cố ${id} tới Trưởng ban Vận hành cảng!`)
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
      <div className="flex justify-between items-center border-b border-chalk pb-4">
        <div>
          <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-0.5 rounded uppercase">
            AI Operations & Safety
          </span>
          <h2 className="font-heading text-4xl text-carbon font-bold mt-1">Quản lý Sự cố & AI Cảnh báo</h2>
          <p className="text-sm text-slate mt-1">Giám sát hình ảnh camera OCR AI, phát hiện tắc nghẽn và tiếp nhận sự cố kỹ thuật.</p>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 border border-chalk rounded-lg shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-signal-orange animate-ping"></span>
          <span className="text-xs font-mono font-bold text-carbon">{utcTime}</span>
        </div>
      </div>

      {/* KPI Row (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate uppercase">Sự cố đang mở</span>
            <div className="font-heading text-3xl font-bold text-signal-orange mt-1">24</div>
          </div>
          <span className="text-xs font-bold text-signal-orange bg-orange-50 px-2.5 py-1 rounded-full">+3 sự cố mới</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate uppercase">Đang xử lý</span>
            <div className="font-heading text-3xl font-bold text-carbon mt-1">12</div>
          </div>
          <span className="text-xs font-bold text-slate bg-fog px-2.5 py-1 rounded-full">Theo dõi kíp ca</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate uppercase">Đã giải quyết hôm nay</span>
            <div className="font-heading text-3xl font-bold text-green-600 mt-1">45</div>
          </div>
          <span className="material-symbols-outlined text-green-600 text-2xl">check_circle</span>
        </div>
      </div>

      {/* Main Split Area (Left List 380px / Right Detail 1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: INCIDENT LIST (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-heading text-lg font-bold text-carbon">Danh sách Sự cố</h3>
            
            {/* Filter Pills */}
            <div className="flex gap-1 text-[11px] font-bold">
              {['Tất cả', 'Mở', 'Đang xử lý', 'Đã giải quyết'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    filter === f ? 'bg-carbon text-white shadow-sm' : 'border border-chalk text-graphite hover:border-carbon'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredIncidents.map(inc => {
              const isSelected = selectedIncident?.id === inc.id
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`bg-white rounded-xl p-5 border cursor-pointer transition-all relative overflow-hidden shadow-sm hover:shadow-md space-y-2 ${
                    isSelected ? 'border-2 border-signal-orange ring-1 ring-signal-orange/20' : 'border-chalk hover:border-slate'
                  }`}
                >
                  {inc.priority === 'KHẨN CẤP' && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-signal-orange"></div>
                  )}

                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      inc.priority === 'KHẨN CẤP' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-fog text-carbon'
                    }`}>
                      {inc.priority}
                    </span>
                    <span className="text-[10px] text-slate">{inc.timeAgo}</span>
                  </div>

                  <h4 className="font-bold text-carbon text-sm">{inc.title}</h4>
                  <p className="text-xs text-slate line-clamp-2">{inc.summary}</p>

                  <div className="flex gap-2 pt-2">
                    {inc.tags.map((t, idx) => (
                      <span key={idx} className="text-[9px] font-bold bg-fog border border-chalk text-graphite px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: INCIDENT DETAIL (8 cols) */}
        {selectedIncident && (
          <div className="lg:col-span-8 bg-white rounded-xl border border-chalk shadow-sm p-6 space-y-6">
            
            {/* Detail Header */}
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded text-xs font-bold tracking-wide ${selectedIncident.badgeColor}`}>
                  ƯU TIÊN {selectedIncident.priority}
                </span>
                <span className="text-slate font-mono text-xs font-bold">{selectedIncident.code}</span>
              </div>

              <div className="flex gap-2">
                <button className="w-8 h-8 rounded-full border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[18px]">share</span>
                </button>
              </div>
            </div>

            {/* Visual Evidence Section */}
            <div className="space-y-3">
              <h4 className="font-bold text-carbon text-sm">Hình ảnh minh chứng AI / CCTV</h4>
              <div className="relative rounded-xl overflow-hidden bg-[#141414] border border-chalk aspect-video max-h-[300px]">
                <img
                  src={selectedIncident.image}
                  alt="Evidence camera footage"
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute top-3 right-3 bg-black/80 text-white text-[10px] font-mono px-2.5 py-1 rounded border border-white/20">
                  CCTV LIVE STREAM // {utcTime}
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="bg-fog rounded-xl p-5 grid grid-cols-2 gap-6 text-xs border border-chalk">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate block mb-1">Vị trí xảy ra</span>
                <span className="font-bold text-carbon text-sm">{selectedIncident.location}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate block mb-1">Phát hiện bởi</span>
                <div className="flex items-center gap-1.5 font-bold text-carbon text-sm">
                  <span className="material-symbols-outlined text-signal-orange text-base">security</span>
                  {selectedIncident.detectedBy}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate block mb-1">Mức độ ảnh hưởng</span>
                <span className="font-bold text-carbon text-sm">{selectedIncident.impact}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate block mb-1">Cán bộ xử lý</span>
                <span className="font-bold text-carbon text-sm">{selectedIncident.handler}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h4 className="font-bold text-carbon text-sm">Dòng thời gian diễn biến sự cố</h4>
              <div className="relative pl-4 border-l border-chalk space-y-4 text-xs ml-2">
                {selectedIncident.timeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 bg-white border-2 border-signal-orange rounded-full"></div>
                    <div className="text-[10px] font-mono text-slate font-bold">{item.time}</div>
                    <div className="font-semibold text-carbon mt-0.5">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-4 border-t border-chalk flex justify-end gap-3">
              <button
                onClick={() => handleEscalate(selectedIncident.id)}
                className="px-6 py-2.5 rounded-full border border-carbon text-carbon font-bold text-xs hover:bg-fog transition-colors"
              >
                Leo thang báo cáo
              </button>
              
              <button
                onClick={() => handleResolve(selectedIncident.id)}
                className="px-6 py-2.5 rounded-full bg-carbon text-white font-bold text-xs hover:bg-black transition-colors shadow"
              >
                Giải quyết sự cố
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  )
}
